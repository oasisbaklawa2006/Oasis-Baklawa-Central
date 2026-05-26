import { describe, expect, it } from "vitest";
import { reconcileReservationsForConsumption } from "../stockReservationReconciliation";
import type { StockReservationRecord } from "../stockReservationTypes";

function res(partial: Partial<StockReservationRecord> & Pick<StockReservationRecord, "id">): StockReservationRecord {
  return {
    reservationNumber: "RSV",
    orderId: "o1",
    productId: "p1",
    sku: "SKU",
    requestedQty: 10,
    reservedQty: 10,
    fulfilledQty: 0,
    releasedQty: 0,
    reservationStatus: "reserved",
    ...partial,
  };
}

describe("stockReservationReconciliation", () => {
  it("aligns consumable reservations", () => {
    const result = reconcileReservationsForConsumption([res({ id: "r1" })]);
    expect(result.reconciliationStatus).toBe("aligned");
    expect(result.consumedQty).toBe(10);
  });

  it("blocks pending reservations", () => {
    const result = reconcileReservationsForConsumption([
      res({ id: "r1", reservationStatus: "pending", reservedQty: 0 }),
    ]);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("marks variance when unresolved reservation qty remains", () => {
    const result = reconcileReservationsForConsumption([
      res({ id: "r1", requestedQty: 10, reservedQty: 5 }),
    ]);
    expect(result.reconciliationStatus).toBe("variance");
    expect(result.varianceQty).toBe(5);
    expect(result.blockers).toContain("reservation_reconciliation_variance");
  });
});
