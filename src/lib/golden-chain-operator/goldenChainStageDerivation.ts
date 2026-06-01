import { projectDispatchCompletion } from "@/lib/dispatch-completion";
import { projectDispatchRelease } from "@/lib/dispatch-finalization/dispatchFinalizationProjection";
import { projectDispatchReadiness } from "@/lib/dispatch-readiness/dispatchReadinessProjection";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import { projectStockFinalization } from "@/lib/stock-finalization/stockFinalizationProjection";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import type { FinalizationLineageSlice } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";
import { hasGovernedDispatchFinalizeLineage } from "./goldenChainDuplicateGuards";
import {
  filterActiveReservationsForStock,
  orderHasStockConsumptionFinalized,
} from "./goldenChainStockFilters";
import type { GoldenChainCtaLabel, GoldenChainStage } from "./goldenChainTypes";

export interface GoldenChainDerivationInput {
  readinessInput: DispatchReadinessInput;
  financeInput: FinanceGovernanceInput;
  completionInput: DispatchCompletionInput;
  finalizationInput: DispatchFinalizationInput;
  stockInput: StockFinalizationInput | null;
  reservations: StockReservationRecord[];
  dispatchLineage: FinalizationLineageSlice[];
  consumptionFinalizedReservationIds: string[];
}

export interface GoldenChainDerivationResult {
  stage: GoldenChainStage;
  cta: GoldenChainCtaLabel;
  rawBlockers: string[];
  dispatchAlreadyFinalized: boolean;
  stockConsumptionComplete: boolean;
}

const STAGE_LABELS: Record<GoldenChainStage, string> = {
  "4b_readiness": "Dispatch check",
  "4c_finance": "Finance approval",
  "4d_completion": "Completion confirmation",
  "4e_dispatch_finalization": "Dispatch finalize",
  "4f_reservation": "Reserve stock",
  "4g_stock": "Deduct stock",
  complete: "Done",
};

export function governanceStageLabel(stage: GoldenChainStage): string {
  return STAGE_LABELS[stage];
}

function hasActiveGovernedReservation(reservations: StockReservationRecord[]): boolean {
  const active = filterActiveReservationsForStock(reservations);
  return active.some(
    (r) =>
      (r.reservationStatus === "reserved" || r.reservationStatus === "partially_reserved") &&
      r.reservedQty > 0,
  );
}

export function deriveGoldenChainStage(input: GoldenChainDerivationInput): GoldenChainDerivationResult {
  const readiness = projectDispatchReadiness(input.readinessInput);
  const finance = projectFinanceRelease(input.financeInput);
  const completion = projectDispatchCompletion(input.completionInput);
  const finalization = projectDispatchRelease(input.finalizationInput);
  const dispatchAlreadyFinalized = hasGovernedDispatchFinalizeLineage(input.dispatchLineage);

  const stockConsumptionComplete = orderHasStockConsumptionFinalized(
    input.consumptionFinalizedReservationIds.map((id) => ({
      reservationId: id,
      lineageType: "consumption_finalized",
    })),
    input.reservations,
  );

  const rawBlockers: string[] = [];

  if (readiness.readinessStatus !== "gate_eligible") {
    rawBlockers.push(...readiness.blockingReasons, ...readiness.missingRequirements);
    return stageResult("4b_readiness", "Complete readiness", rawBlockers, dispatchAlreadyFinalized, stockConsumptionComplete);
  }

  if (finance.releaseStatus !== "commercially_released") {
    rawBlockers.push(...finance.blockingReasons);
    return stageResult("4c_finance", "Complete finance release", rawBlockers, dispatchAlreadyFinalized, stockConsumptionComplete);
  }

  const orderDispatchedEarly =
    ["dispatched", "in_transit", "delivered"].includes(
      input.finalizationInput.currentOrderStatus.trim().toLowerCase(),
    ) || dispatchAlreadyFinalized;

  const completionSatisfied =
    completion.completionStatus === "completion_attested" ||
    (orderDispatchedEarly && completion.completionStatus === "already_dispatched");

  if (!completionSatisfied) {
    rawBlockers.push(...completion.blockingReasons);
    return stageResult("4d_completion", "Complete completion attestation", rawBlockers, dispatchAlreadyFinalized, stockConsumptionComplete);
  }

  const orderDispatched =
    ["dispatched", "in_transit", "delivered"].includes(
      input.finalizationInput.currentOrderStatus.trim().toLowerCase(),
    ) || dispatchAlreadyFinalized;

  if (!orderDispatched) {
    rawBlockers.push(...finalization.blockingReasons);
    if (dispatchAlreadyFinalized) {
      rawBlockers.push("dispatch_finalize_lineage_exists");
    }
    const cta: GoldenChainCtaLabel = dispatchAlreadyFinalized
      ? "Already complete"
      : finalization.canFinalize
        ? "Finalize dispatch"
        : "Finalize dispatch";
    return stageResult("4e_dispatch_finalization", cta, rawBlockers, dispatchAlreadyFinalized, stockConsumptionComplete);
  }

  if (!hasActiveGovernedReservation(input.reservations)) {
    rawBlockers.push("no_active_reservation");
    return stageResult("4f_reservation", "Create reservation", rawBlockers, dispatchAlreadyFinalized, stockConsumptionComplete);
  }

  if (!stockConsumptionComplete && input.stockInput) {
    const stock = projectStockFinalization(input.stockInput);
    if (!stock.canFinalizeConsumption) {
      rawBlockers.push(...stock.blockingReasons);
      return stageResult("4g_stock", "Finalize stock consumption", rawBlockers, dispatchAlreadyFinalized, false);
    }
    return stageResult("4g_stock", "Finalize stock consumption", rawBlockers, dispatchAlreadyFinalized, false);
  }

  if (!stockConsumptionComplete) {
    rawBlockers.push("stock_consumption_pending");
    return stageResult("4g_stock", "Finalize stock consumption", rawBlockers, dispatchAlreadyFinalized, false);
  }

  return stageResult("complete", "Already complete", [], dispatchAlreadyFinalized, true);
}

function stageResult(
  stage: GoldenChainStage,
  cta: GoldenChainCtaLabel,
  rawBlockers: string[],
  dispatchAlreadyFinalized: boolean,
  stockConsumptionComplete: boolean,
): GoldenChainDerivationResult {
  let resolvedCta = cta;
  if (stage === "4e_dispatch_finalization" && dispatchAlreadyFinalized) {
    resolvedCta = "Already complete";
  }
  return {
    stage,
    cta: resolvedCta,
    rawBlockers: [...new Set(rawBlockers)],
    dispatchAlreadyFinalized,
    stockConsumptionComplete,
  };
}
