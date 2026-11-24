import { describe, expect, it } from "vitest";
import { applyKeysetWindow, compareTimestamps, loadKeysetPages, loadTableByKeyset } from "../rgsKeysetLoader";
import { makeKeysetFakeDb } from "./keysetFakeDb";

type R = { id: string; created_at: string | null };
const pad = (n: number) => `row-${String(n).padStart(5, "0")}`;
const ts = (n: number) => `2026-11-${String(1 + (n % 20)).padStart(2, "0")}T10:00:00.${String(n).padStart(6, "0")}+00:00`;

describe("rgsKeysetLoader", () => {
  it("loads >500 rows (all four dependent-table shapes) with no cap, regardless of source order", async () => {
    for (const relation of ["inventory_reservations", "production_jobs", "production_rgs_transfers"]) {
      const rows: R[] = Array.from({ length: 1203 }, (_, i) => ({ id: pad(i), created_at: ts(i) })).reverse();
      const { db, calls } = makeKeysetFakeDb({ [relation]: rows });
      const out = await loadTableByKeyset<R>(db, relation, "id, created_at", { column: "created_at", get: (r) => r.created_at });
      expect(out).toHaveLength(1203);
      expect(new Set(out.map((r) => r.id)).size).toBe(1203);
      let ascending = true;
      out.reduce<R | null>((prev, cur) => {
        if (prev && compareTimestamps(prev.created_at as string, cur.created_at as string) > 0) ascending = false;
        return cur;
      }, null);
      expect(ascending).toBe(true);
      expect(calls.every((c) => c.limit === 250)).toBe(true);
    }
    const issues = Array.from({ length: 700 }, (_, i) => ({ id: pad(i), issued_at: ts(i) })).reverse();
    const { db } = makeKeysetFakeDb({ rgs_issue_events: issues });
    expect(await loadTableByKeyset<{ id: string; issued_at: string }>(db, "rgs_issue_events", "id, issued_at", { column: "issued_at", get: (r) => r.issued_at })).toHaveLength(700);
  });

  it("breaks identical-timestamp ties by id without skipping rows across a page boundary", async () => {
    const same = "2026-11-05T10:00:00+00:00";
    const rows: R[] = Array.from({ length: 600 }, (_, i) => ({ id: pad(i), created_at: same })).reverse();
    const { db } = makeKeysetFakeDb({ t: rows });
    const out = await loadTableByKeyset<R>(db, "t", "id", { column: "created_at", get: (r) => r.created_at });
    expect(out.map((r) => r.id)).toEqual(Array.from({ length: 600 }, (_, i) => pad(i)));
  });

  it("reads NULL-timestamp rows in an explicit second phase (never silently skipped)", async () => {
    const rows: R[] = [
      ...Array.from({ length: 300 }, (_, i) => ({ id: pad(i), created_at: ts(i) })),
      ...Array.from({ length: 260 }, (_, i) => ({ id: pad(1000 + i), created_at: null })),
    ];
    const { db, calls } = makeKeysetFakeDb({ t: rows });
    const out = await loadTableByKeyset<R>(db, "t", "id", { column: "created_at", get: (r) => r.created_at });
    expect(out).toHaveLength(560);
    expect(out.slice(300).every((r) => r.created_at === null)).toBe(true);
    expect(calls.some((c) => c.phase === "null_timestamp")).toBe(true);
  });

  it("fails closed when any page errors", async () => {
    const rows: R[] = Array.from({ length: 600 }, (_, i) => ({ id: pad(i), created_at: ts(i) }));
    const { db } = makeKeysetFakeDb({ inventory_reservations: rows }, ({ index }) =>
      index === 1 ? { data: null, error: { message: "statement timeout" } } : undefined);
    await expect(loadTableByKeyset<R>(db, "inventory_reservations", "id", { column: "created_at", get: (r) => r.created_at }))
      .rejects.toThrow("inventory_reservations read failed: statement timeout");
  });

  const run = (pages: unknown[][]) => {
    let i = 0;
    return loadKeysetPages<R>({
      label: "t", pageSize: 2,
      getId: (r) => r?.id, getTimestamp: (r) => r?.created_at,
      fetchPage: async () => ({ data: i < pages.length ? pages[i++] : [], error: null }),
    });
  };
  const a = { id: "a", created_at: "2026-11-01T00:00:00+00:00" };
  const b = { id: "b", created_at: "2026-11-02T00:00:00+00:00" };
  const c = { id: "c", created_at: "2026-11-03T00:00:00+00:00" };

  it("rejects non-array data, malformed rows, duplicates, repeated and non-monotonic pages", async () => {
    await expect(run([null as unknown as unknown[]])).rejects.toThrow("invalid data");
    await expect(run([[{ created_at: a.created_at }]])).rejects.toThrow("malformed row");
    await expect(run([[a, { id: "x", created_at: "garbage" }]])).rejects.toThrow("invalid timestamp");
    await expect(run([[a, b], [b, c]])).rejects.toThrow("source changed during pagination");
    await expect(run([[a, b], [a]])).rejects.toThrow("source changed during pagination");
    await expect(run([[b, a]])).rejects.toThrow("non-monotonic");
    await expect(run([[a, b], [{ id: "z", created_at: a.created_at }]])).rejects.toThrow("non-monotonic");
    await expect(run([[a, b, c]])).rejects.toThrow("oversized page");
  });

  it("rejects a non-null timestamp in the NULL phase and an invalid page size", async () => {
    await expect(run([[a], [b]])).rejects.toThrow("source changed during pagination");
    await expect(loadKeysetPages<R>({ label: "t", pageSize: 0, getId: (r) => r.id, getTimestamp: (r) => r.created_at, fetchPage: async () => ({ data: [], error: null }) }))
      .rejects.toThrow("invalid page size");
  });

  it("refuses to interpolate a malformed cursor into the or() filter", () => {
    const q = { not: () => q, is: () => q, gt: () => q, or: () => q, order: () => q, limit: () => Promise.resolve({ data: [], error: null }) };
    expect(() => applyKeysetWindow(q, "created_at", { phase: "timestamped", limit: 5, after: { timestamp: "2026-11-01T00:00:00+00:00", id: "a),id.gt.(" } }))
      .toThrow("malformed");
    expect(() => applyKeysetWindow(q, "created_at", { phase: "timestamped", limit: 5, after: { timestamp: "x,or(1)", id: "a" } }))
      .toThrow("malformed");
  });

  it("compares microsecond timestamps with dropped trailing zeros correctly", () => {
    expect(compareTimestamps("2026-11-01T00:00:00.12+00:00", "2026-11-01T00:00:00.120001+00:00")).toBe(-1);
    expect(compareTimestamps("2026-11-01T00:00:00.5+00:00", "2026-11-01T00:00:00.500000+00:00")).toBe(0);
  });

  it("pages primary-key tables by id alone (idOnly) and rejects non-monotonic ids", async () => {
    const rows = Array.from({ length: 700 }, (_, i) => ({ id: pad(i) })).reverse();
    const { db } = makeKeysetFakeDb({ order_items: rows });
    const out = await loadKeysetPages<{ id: string }>({
      label: "order_items", idOnly: true, getId: (r) => r.id, getTimestamp: () => null,
      fetchPage: (req) => applyKeysetWindow((db.from("order_items") as { select: (c: string) => unknown }).select("id"), "id", req),
    });
    expect(out.map((r) => r.id)).toEqual(Array.from({ length: 700 }, (_, i) => pad(i)));
    await expect(loadKeysetPages<{ id: string }>({
      label: "t", idOnly: true, pageSize: 2, getId: (r) => r.id, getTimestamp: () => null,
      fetchPage: async () => ({ data: [{ id: "b" }, { id: "a" }], error: null }),
    })).rejects.toThrow("non-monotonic");
  });
});
