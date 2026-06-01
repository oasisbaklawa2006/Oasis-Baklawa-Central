import { describe, expect, it } from "vitest";
import {
  goldenChainUserCanReserveStock,
  orderHasActiveReservedStock,
} from "../goldenChainReservationAccess";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

describe("goldenChainReservationAccess", () => {
  it("orderHasActiveReservedStock detects reserved rows", () => {
    const rows: StockReservationRecord[] = [
      {
        id: "r1",
        reservationNumber: "RES-1",
        orderId: "o1",
        productId: "p1",
        sku: "SKU",
        requestedQty: 2,
        reservedQty: 2,
        fulfilledQty: 0,
        releasedQty: 0,
        reservationStatus: "reserved",
      },
    ];
    expect(orderHasActiveReservedStock(rows)).toBe(true);
  });

  it("dispatch head can reserve in golden chain", () => {
    expect(goldenChainUserCanReserveStock("DISPATCH_HEAD")).toBe(true);
  });
});
