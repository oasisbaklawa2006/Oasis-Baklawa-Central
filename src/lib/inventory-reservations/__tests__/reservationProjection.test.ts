import { describe, expect, it } from "vitest";
import { projectBoardReservationIndicator } from "../reservationProjection";
import type { InventoryReservationRecord } from "../reservationTypes";

function res(partial: Partial<InventoryReservationRecord>): InventoryReservationRecord {
  return {
    id: "r1",
    reservationNumber: "RES-1",
    orderId: "o1",
    queueItemId: null,
    customerId: null,
    productId: "p1",
    sku: "SKU",
    requestedQty: 10,
    reservedQty: 5,
    fulfilledQty: 0,
    releasedQty: 0,
    reservationStatus: "partially_reserved",
    reservationPriority: "normal",
    sourceDepartment: null,
    reservedBy: null,
    approvedBy: null,
    expiresAt: null,
    notes: null,
    correlationId: "c",
    version: 1,
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z",
    ...partial,
  };
}

describe("reservationProjection", () => {
  it("shows partial for order", () => {
    expect(
      projectBoardReservationIndicator("o1", [res({ orderId: "o1" })], "2026-05-24T12:00:00.000Z"),
    ).toBe("partial");
  });

  it("shows expired", () => {
    expect(
      projectBoardReservationIndicator(
        "o1",
        [res({ orderId: "o1", expiresAt: "2026-05-20T00:00:00.000Z", reservationStatus: "pending" })],
        "2026-05-24T12:00:00.000Z",
      ),
    ).toBe("expired");
  });
});
