import { describe, expect, it } from "vitest";
import {
  factoryOrderLineReference,
  isFactoryJobForLine,
  isTerminalReservation,
  isUnresolvedLegacyReservation,
  resolveFactoryLineReservations,
  type FactoryLineReservation,
} from "../factoryOrderLineage";

const order = "SO-1", product = "SAME-SKU";
const lines = [
  { id: "line-1", order_id: order, product_id: product },
  { id: "line-2", order_id: order, product_id: product },
];
const res = (over: Partial<FactoryLineReservation> & { id: string }): FactoryLineReservation => ({
  order_id: order, product_id: product, demand_reference: null, reservation_status: "reserved", reserved_qty: 5, ...over,
});
const reservations = [
  res({ id: "res-1", demand_reference: factoryOrderLineReference("line-1") }),
  res({ id: "res-2", demand_reference: factoryOrderLineReference("line-2") }),
];

describe("Factory F04/F44 exact sales-order-line attribution", () => {
  it("does not borrow a reservation from another same-SKU line", () => {
    const first = resolveFactoryLineReservations(lines[0], reservations);
    const second = resolveFactoryLineReservations(lines[1], reservations);
    expect(first.matched.map((r) => r.id)).toEqual(["res-1"]);
    expect(second.matched.map((r) => r.id)).toEqual(["res-2"]);
    expect(first.ambiguousLegacy).toBe(false);
    expect(second.ambiguousLegacy).toBe(false);
  });

  it("does not duplicate production jobs across same-SKU lines", () => {
    const firstIds = new Set(["res-1"]), secondIds = new Set(["res-2"]);
    const job = { order_item_id: null, reservation_id: "res-1" };
    expect(isFactoryJobForLine(job, "line-1", firstIds)).toBe(true);
    expect(isFactoryJobForLine(job, "line-2", secondIds)).toBe(false);
    expect(isFactoryJobForLine({ order_item_id: "line-2", reservation_id: null }, "line-2", secondIds)).toBe(true);
  });

  it("blocks new allocation where an open historical same-SKU reservation lacks a source-line anchor", () => {
    const legacy = res({ id: "res-unassigned" });
    const out = resolveFactoryLineReservations(lines[0], [...reservations, legacy]);
    expect(out.matched.map((r) => r.id)).toEqual(["res-1"]);
    expect(out.ambiguousLegacy).toBe(true);
  });

  it("never auto-assigns a legacy reservation to any line", () => {
    const legacy = res({ id: "res-unassigned" });
    for (const line of lines) {
      expect(resolveFactoryLineReservations(line, [legacy]).matched).toEqual([]);
    }
  });

  it("does not classify a different explicitly anchored line as legacy ambiguity", () => {
    expect(resolveFactoryLineReservations(lines[0], reservations).ambiguousLegacy).toBe(false);
  });

  it.each(["released", "fulfilled", "cancelled", "expired"])(
    "excludes a terminal (%s) legacy reservation from ambiguity",
    (status) => {
      const legacy = res({ id: "res-old", reservation_status: status, reserved_qty: 3 });
      expect(isTerminalReservation(legacy)).toBe(true);
      expect(isUnresolvedLegacyReservation(legacy)).toBe(false);
      expect(resolveFactoryLineReservations(lines[0], [...reservations, legacy]).ambiguousLegacy).toBe(false);
    },
  );

  it("excludes a zero-qty legacy reservation but keeps every non-terminal Core status ambiguous", () => {
    expect(resolveFactoryLineReservations(lines[0], [res({ id: "z", reserved_qty: 0 })]).ambiguousLegacy).toBe(false);
    for (const status of ["pending", "reserved", "partially_reserved", "blocked"]) {
      expect(isUnresolvedLegacyReservation(res({ id: status, reservation_status: status }))).toBe(true);
    }
  });

  it("treats a non-order_item demand reference as unresolved legacy only while open with stock", () => {
    expect(isUnresolvedLegacyReservation(res({ id: "x", demand_reference: "b2b:abc" }))).toBe(true);
    expect(isUnresolvedLegacyReservation(res({ id: "y", demand_reference: "order_item:line-9" }))).toBe(false);
  });
});
