import type { FinalizeConsumptionLineItem } from "./stockFinalizationTypes";
import type { ReservationReconciliationResult } from "./stockReservationReconciliation";
import { StockFinalizationError } from "./stockFinalizationTypes";

export function validateConsumptionItemsAgainstReconciliation(
  items: FinalizeConsumptionLineItem[],
  reconciliation: ReservationReconciliationResult,
): void {
  if (items.length === 0) {
    throw new StockFinalizationError("validation_failed", "At least one consumption line item is required");
  }

  for (const item of items) {
    const line = reconciliation.lineItems.find((l) => l.reservationId === item.reservationId);
    if (!line) {
      throw new StockFinalizationError(
        "validation_failed",
        `Reservation ${item.reservationId} is not in reconciled consumable lines`,
      );
    }
    if (Math.abs(item.consumeQty - line.consumableQty) > 0.0001) {
      throw new StockFinalizationError(
        "validation_failed",
        `Consume qty ${item.consumeQty} does not match reconciled qty ${line.consumableQty} for ${item.reservationId}`,
      );
    }
    if (item.sku !== line.sku || item.productId !== line.productId) {
      throw new StockFinalizationError(
        "validation_failed",
        `SKU/product mismatch for reservation ${item.reservationId}`,
      );
    }
  }
}
