import { evaluateStockDeductionEligibility } from "./stockDeductionEligibility";
import { reconcileReservationsForConsumption } from "./stockReservationReconciliation";
import type { StockFinalizationInput, StockFinalizationProjection } from "./stockFinalizationTypes";

export function projectStockFinalization(input: StockFinalizationInput): StockFinalizationProjection {
  const eligibility = evaluateStockDeductionEligibility(input);
  const reconciliation = reconcileReservationsForConsumption(
    input.reservations,
    input.alreadyFinalizedReservationIds ?? [],
  );

  const blockingReasons = [...eligibility.blockers, ...reconciliation.blockers];
  const warnings = [...eligibility.warnings, ...reconciliation.warnings];

  let finalizationStatus: StockFinalizationProjection["finalizationStatus"] = "pending_dispatch_finalization";
  if (!eligibility.eligible) {
    finalizationStatus = "consumption_blocked";
  } else if (reconciliation.reconciliationStatus === "variance") {
    finalizationStatus = "variance_detected";
  } else if (reconciliation.lineItems.length > 0) {
    finalizationStatus = "ready_for_consumption";
  }

  return {
    orderId: input.orderId,
    finalizationStatus,
    reconciliationStatus: reconciliation.reconciliationStatus,
    consumedQty: reconciliation.consumedQty,
    varianceQty: reconciliation.varianceQty,
    unresolvedReservationQty: reconciliation.unresolvedReservationQty,
    blockingReasons,
    warnings,
    canFinalizeConsumption:
      eligibility.eligible &&
      reconciliation.reconciliationStatus !== "blocked" &&
      reconciliation.lineItems.length > 0,
    evaluatedAt: new Date().toISOString(),
  };
}
