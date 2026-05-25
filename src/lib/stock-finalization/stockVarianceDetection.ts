import type { StockBalanceRecord } from "./stockFinalizationTypes";
import type { ReservationReconciliationResult } from "./stockReservationReconciliation";

export interface StockVarianceFinding {
  code: "unresolved_reservation" | "insufficient_available" | "reconciliation_mismatch";
  message: string;
  quantity: number;
}

export function detectStockVariance(
  reconciliation: ReservationReconciliationResult,
  balances: Map<string, StockBalanceRecord>,
  locationCode: string,
): StockVarianceFinding[] {
  const findings: StockVarianceFinding[] = [];

  if (reconciliation.unresolvedReservationQty > 0.0001) {
    findings.push({
      code: "unresolved_reservation",
      message: "Unresolved reservation quantity remains after dispatch finalization",
      quantity: reconciliation.unresolvedReservationQty,
    });
  }

  if (reconciliation.reconciliationStatus === "variance") {
    findings.push({
      code: "reconciliation_mismatch",
      message: "Reservation reconciliation reported variance",
      quantity: reconciliation.varianceQty,
    });
  }

  for (const item of reconciliation.lineItems) {
    const key = `${item.productId}:${item.sku}:${locationCode}`;
    const balance = balances.get(key);
    if (!balance) {
      findings.push({
        code: "insufficient_available",
        message: `No balance row for ${item.sku} at ${locationCode}`,
        quantity: item.consumableQty,
      });
      continue;
    }
    if (balance.availableQty < item.consumableQty) {
      findings.push({
        code: "insufficient_available",
        message: `Insufficient available for ${item.sku}: need ${item.consumableQty}, have ${balance.availableQty}`,
        quantity: item.consumableQty - balance.availableQty,
      });
    }
  }

  return findings;
}
