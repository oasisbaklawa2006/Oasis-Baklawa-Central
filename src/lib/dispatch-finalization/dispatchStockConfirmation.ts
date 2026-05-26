import type { DispatchFinalizationOperationalEventType } from "./dispatchFinalizationTypes";

export type StockConfirmationIntent = "confirmed" | "reversed";

export function stockConfirmationEventType(intent: StockConfirmationIntent): DispatchFinalizationOperationalEventType {
  return intent === "confirmed"
    ? "dispatch_stock_consumption_confirmed"
    : "dispatch_stock_consumption_reversed";
}

/** Lineage/event only — no stock table writes in Phase 4E. */
export function buildStockConfirmationMetadata(orderId: string, intent: StockConfirmationIntent, note: string) {
  return {
    orderId,
    intent,
    note,
    physicalDeduction: false,
    stockTableMutation: false,
  };
}
