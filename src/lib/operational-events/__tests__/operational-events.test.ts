import { describe, it, expect } from "vitest";
import { compareOperationalEvents, dedupeOperationalEventsById, normalizeOperationalTimestamp } from "@/lib/operational-events/normalize";
import { buildOrderOperationalFeedFromTrace } from "@/lib/operational-events/orderTraceFeed";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

describe("operational-events normalize", () => {
  it("normalizeOperationalTimestamp returns null for garbage", () => {
    expect(normalizeOperationalTimestamp("")).toBeNull();
    expect(normalizeOperationalTimestamp("not-a-date")).toBeNull();
  });

  it("normalizeOperationalTimestamp returns ISO for valid input", () => {
    const iso = normalizeOperationalTimestamp("2026-01-15T10:00:00.000Z");
    expect(iso).toBe("2026-01-15T10:00:00.000Z");
  });

  it("compareOperationalEvents orders timed rows before untimed", () => {
    const timed: OperationalEventRecord = {
      id: "a",
      kind: "x",
      category: "operational",
      severity: "info",
      title: "t",
      occurredAt: "2026-01-01T00:00:00.000Z",
      sortKey: 999,
      actor: { role: "system" },
      entities: [],
      source: "derived_order_trace",
    };
    const untimed: OperationalEventRecord = {
      id: "b",
      kind: "y",
      category: "operational",
      severity: "info",
      title: "u",
      occurredAt: null,
      sortKey: 1,
      actor: { role: "system" },
      entities: [],
      source: "derived_order_trace",
    };
    const sorted = [untimed, timed].sort(compareOperationalEvents);
    expect(sorted[0].id).toBe("a");
  });

  it("dedupeOperationalEventsById keeps last", () => {
    const a: OperationalEventRecord = {
      id: "same",
      kind: "a",
      category: "operational",
      severity: "info",
      title: "first",
      occurredAt: null,
      sortKey: 1,
      actor: { role: "system" },
      entities: [],
      source: "derived_order_trace",
    };
    const b: OperationalEventRecord = { ...a, title: "second", sortKey: 2 };
    const out = dedupeOperationalEventsById([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("second");
  });
});

describe("buildOrderOperationalFeedFromTrace", () => {
  it("includes order.created when createdAt is valid", () => {
    const events = buildOrderOperationalFeedFromTrace({
      orderId: "11111111-1111-1111-1111-111111111111",
      createdAt: "2026-05-01T08:00:00.000Z",
      financeVerifiedAt: null,
      orderStatus: "submitted",
      paymentStatus: "unpaid",
      finance: { awaiting_advance: false, advance_verified: false, balance_pending: true },
      dispatchBucket: "not_ready",
      pendingReq: { pendingLines: 0, pendingUnits: 0 },
      requisitionCount: 0,
      jobs: [],
      timelineSteps: [
        { label: "A", state: "done" },
        { label: "B", state: "current" },
      ],
      totalOrdered: 0,
      totalPacked: 0,
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("order.created");
    expect(events.find((e) => e.kind === "order.created")?.occurredAt).toBeTruthy();
  });
});
