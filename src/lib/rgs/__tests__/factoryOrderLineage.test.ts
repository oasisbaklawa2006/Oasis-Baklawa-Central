import { describe, expect, it } from "vitest";
import { factoryOrderLineReference, isFactoryJobForLine, resolveFactoryLineReservations } from "../factoryOrderLineage";

const order = "SO-1", product = "SAME-SKU";
const lines = [
  { id: "line-1", order_id: order, product_id: product },
  { id: "line-2", order_id: order, product_id: product },
];
const reservations = [
  { id: "res-1", order_id: order, product_id: product, demand_reference: factoryOrderLineReference("line-1") },
  { id: "res-2", order_id: order, product_id: product, demand_reference: factoryOrderLineReference("line-2") },
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

  it("blocks new allocation where historical same-SKU reservation lacks a source-line anchor", () => {
    const legacy = { id: "res-unassigned", order_id: order, product_id: product, demand_reference: null };
    const res = resolveFactoryLineReservations(lines[0], [...reservations, legacy]);
    expect(res.matched.map((r) => r.id)).toEqual(["res-1"]);
    expect(res.ambiguousLegacy).toBe(true);
  });

  it("does not classify a different explicitly anchored line as legacy ambiguity", () => {
    const res = resolveFactoryLineReservations(lines[0], reservations);
    expect(res.ambiguousLegacy).toBe(false);
  });
});
