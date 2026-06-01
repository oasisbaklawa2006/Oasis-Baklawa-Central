import { describe, expect, it } from "vitest";
import { orderHasStockConsumptionFinalized } from "../goldenChainStockFilters";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

function reservation(partial: Partial<StockReservationRecord>): StockReservationRecord {
  return {
    id: "res-1",
    orderId: "ord-1",
    reservationNumber: "RSV-1",
    productId: "prod-1",
    sku: "OAS-PUR-1",
    requestedQty: 2,
    reservedQty: 2,
    fulfilledQty: 0,
    reservationStatus: "reserved",
    version: 1,
    ...partial,
  } as StockReservationRecord;
}

describe("orderHasStockConsumptionFinalized", () => {
  it("returns false when lineage exists but reservation row is not fulfilled (SO-118 drift)", () => {
    const reservations = [reservation({ id: "res-118", fulfilledQty: 0, reservationStatus: "reserved" })];
    const lineage = [{ reservationId: "res-118", lineageType: "consumption_finalized" }];
    expect(orderHasStockConsumptionFinalized(lineage, reservations)).toBe(false);
  });

  it("returns true when lineage and reservation row are both fulfilled", () => {
    const reservations = [
      reservation({
        id: "res-118",
        fulfilledQty: 2,
        reservedQty: 0,
        reservationStatus: "fulfilled",
      }),
    ];
    const lineage = [{ reservationId: "res-118", lineageType: "consumption_finalized" }];
    expect(orderHasStockConsumptionFinalized(lineage, reservations)).toBe(true);
  });
});
