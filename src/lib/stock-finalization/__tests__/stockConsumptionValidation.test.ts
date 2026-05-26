import { describe, expect, it } from "vitest";
import { reconcileReservationsForConsumption } from "../stockReservationReconciliation";
import { validateConsumptionItemsAgainstReconciliation } from "../stockConsumptionValidation";
import { StockFinalizationError } from "../stockFinalizationTypes";

describe("stockConsumptionValidation", () => {
  it("rejects consume qty mismatch vs reconciliation", () => {
    const reconciliation = reconcileReservationsForConsumption([
      {
        id: "r1",
        reservationNumber: "RSV",
        orderId: "o1",
        productId: "p1",
        sku: "SKU-A",
        requestedQty: 5,
        reservedQty: 5,
        fulfilledQty: 0,
        releasedQty: 0,
        reservationStatus: "reserved",
      },
    ]);
    expect(() =>
      validateConsumptionItemsAgainstReconciliation(
        [
          {
            reservationId: "r1",
            productId: "p1",
            sku: "SKU-A",
            locationCode: "WH",
            consumeQty: 3,
            expectedBalanceVersion: 1,
          },
        ],
        reconciliation,
      ),
    ).toThrow(StockFinalizationError);
  });
});
