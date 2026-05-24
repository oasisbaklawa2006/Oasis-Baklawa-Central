import { describe, it, expect } from "vitest";
import {
  buildStoreCoordinationOperationalFeed,
  DEFAULT_RETAIL_OUTLETS,
  normalizeStoreCoordinationEvents,
} from "@/lib/operational-events/storeFeed";

describe("buildStoreCoordinationOperationalFeed", () => {
  it("emits stock unknown per outlet with null occurredAt and deterministic ids", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "outlet-test", name: "Test Store" }],
      reservations: [],
      followups: [],
      nowMs: 1_700_000_000_000,
    });
    const unk = events.filter((e) => e.kind === "store.stock_unknown");
    expect(unk).toHaveLength(1);
    expect(unk[0].id).toBe("store-coord:outlet:outlet-test:stock_unknown");
    expect(unk[0].occurredAt).toBeNull();
  });

  it("defaults to canonical outlets when outlets array is empty", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [],
      reservations: [],
      followups: [],
      nowMs: 0,
    });
    expect(events.filter((e) => e.kind === "store.stock_unknown")).toHaveLength(DEFAULT_RETAIL_OUTLETS.length);
  });

  it("emits reservation pending and pickup placeholder when no reservations", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "a", name: "A" }],
      reservations: [],
      followups: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === "store.prebooking_pending")).toBe(true);
    expect(events.some((e) => e.kind === "store.pickup_pending")).toBe(true);
    expect(events.find((e) => e.kind === "store.prebooking_pending")?.id).toBe("store-coord:reservations:prebooking_pending");
  });

  it("emits factory follow-up pending when no followups", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "a", name: "A" }],
      reservations: [],
      followups: [],
      nowMs: 0,
    });
    const f = events.find((e) => e.kind === "store.factory_followup_needed" && e.id === "store-coord:factory:followup_pending");
    expect(f).toBeDefined();
    expect(f!.occurredAt).toBeNull();
  });

  it("never fabricates occurredAt timestamps on snapshot rows", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "x", name: "X" }],
      reservations: [],
      followups: [],
      nowMs: 99_999_999,
    });
    for (const e of events) {
      expect(e.occurredAt).toBeNull();
    }
  });

  it("omits per-outlet stock_unknown placeholders when suppressPlaceholderOutletStockUnknown is true", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "outlet-test", name: "Test Store" }],
      reservations: [],
      followups: [],
      nowMs: 0,
      suppressPlaceholderOutletStockUnknown: true,
    });
    expect(events.filter((e) => e.kind === "store.stock_unknown")).toHaveLength(0);
  });

  it("emits deterministic ids for a concrete reservation row", () => {
    const events = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "o1", name: "Outlet" }],
      reservations: [
        {
          id: "res-1",
          customer: "Neha",
          store: "South Extension",
          product: "Assorted premium tray",
          qty: "2",
          pickupDate: "2026-06-01",
          status: "Requested",
          notes: "Call before packing",
        },
      ],
      followups: [],
      nowMs: 0,
    });
    expect(events.some((e) => e.id === "store-coord:reservation:res-1:requested")).toBe(true);
    expect(events.some((e) => e.id === "store-coord:reservation:res-1:pickup_pending")).toBe(true);
  });

  it("normalizeStoreCoordinationEvents is stable for duplicate ids", () => {
    const a = buildStoreCoordinationOperationalFeed({
      outlets: [{ id: "a", name: "A" }],
      reservations: [],
      followups: [],
      nowMs: 0,
    });
    const merged = normalizeStoreCoordinationEvents([...a, ...a]);
    const ids = new Set(merged.map((e) => e.id));
    expect(ids.size).toBe(merged.length);
  });
});
