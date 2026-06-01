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
import type {
  ReadinessEvidenceSlice,
  ReadinessScanSlice,
} from "@/lib/execution-read-models/adapters/readinessSignalAdapter";
import { hasGovernedDispatchFinalizeLineage } from "./goldenChainDuplicateGuards";
import { hasVerifiedManualReadinessReview } from "./goldenChainCompletionInput";
import {
  isDispatchEvidencePrepared,
  missingDispatchEvidenceLabels,
} from "./goldenChainPrerequisites";
import {
  filterActiveReservationsForStock,
  orderHasStockConsumptionFinalized,
} from "./goldenChainStockFilters";
import type { GoldenChainCtaLabel, GoldenChainStage } from "./goldenChainTypes";

export interface FinanceEvidenceSlice {
  reviewType: string;
  reviewStatus: string;
}

export interface GoldenChainDerivationInput {
  readinessInput: DispatchReadinessInput;
  financeInput: FinanceGovernanceInput;
  completionInput: DispatchCompletionInput;
  finalizationInput: DispatchFinalizationInput;
  stockInput: StockFinalizationInput | null;
  reservations: StockReservationRecord[];
  dispatchLineage: FinalizationLineageSlice[];
  consumptionFinalizedReservationIds: string[];
  readinessEvidenceSlices: ReadinessEvidenceSlice[];
  scanSlice: ReadinessScanSlice;
  dispatchEvidencePrepared: boolean;
  financeCommerciallyReleased: boolean;
  completionAttested: boolean;
}

export interface GoldenChainDerivationResult {
  stage: GoldenChainStage;
  cta: GoldenChainCtaLabel;
  rawBlockers: string[];
  dispatchAlreadyFinalized: boolean;
  stockConsumptionComplete: boolean;
}

const STAGE_LABELS: Record<GoldenChainStage, string> = {
  prepare_dispatch_evidence: "Prepare evidence",
  finance_release: "Finance approval",
  readiness_review: "Readiness review",
  completion_attestation: "Completion",
  dispatch_finalization: "Finalize dispatch",
  reservation: "Reserve stock",
  stock_finalization: "Deduct stock",
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

function readinessInputForReview(input: DispatchReadinessInput): DispatchReadinessInput {
  return {
    ...input,
    readinessPolicy: input.readinessPolicy ?? "pre_dispatch",
  };
}

export function deriveGoldenChainStage(input: GoldenChainDerivationInput): GoldenChainDerivationResult {
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

  if (!input.dispatchEvidencePrepared) {
    rawBlockers.push(
      ...missingDispatchEvidenceLabels(input.readinessEvidenceSlices, input.scanSlice),
    );
    return stageResult(
      "prepare_dispatch_evidence",
      "Prepare dispatch evidence",
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
  }

  if (!input.financeCommerciallyReleased) {
    rawBlockers.push(...finance.blockingReasons);
    return stageResult(
      "finance_release",
      "Complete finance release",
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
  }

  const readiness = projectDispatchReadiness(readinessInputForReview(input.readinessInput));
  const manualReadinessReviewed = hasVerifiedManualReadinessReview(input.readinessEvidenceSlices);
  if (readiness.readinessStatus !== "gate_eligible" || !manualReadinessReviewed) {
    rawBlockers.push(...readiness.blockingReasons, ...readiness.missingRequirements);
    if (readiness.readinessStatus === "gate_eligible" && !manualReadinessReviewed) {
      rawBlockers.push("Operator readiness review not recorded (manual_readiness_review)");
    }
    return stageResult(
      "readiness_review",
      "Complete readiness review",
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
  }

  const orderDispatchedEarly =
    ["dispatched", "in_transit", "delivered"].includes(
      input.finalizationInput.currentOrderStatus.trim().toLowerCase(),
    ) || dispatchAlreadyFinalized;

  const completionSatisfied =
    input.completionAttested ||
    completion.completionStatus === "completion_attested" ||
    (orderDispatchedEarly && completion.completionStatus === "already_dispatched");

  if (!completionSatisfied) {
    rawBlockers.push(...completion.blockingReasons);
    const cta: GoldenChainCtaLabel = input.completionAttested
      ? "Completion already attested"
      : "Attest completion";
    return stageResult(
      "completion_attestation",
      cta,
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
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
      : "Finalize dispatch";
    return stageResult(
      "dispatch_finalization",
      cta,
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
  }

  if (stockConsumptionComplete) {
    return stageResult("complete", "Already complete", [], dispatchAlreadyFinalized, true);
  }

  if (!hasActiveGovernedReservation(input.reservations)) {
    rawBlockers.push("no_active_reservation");
    return stageResult(
      "reservation",
      "Reserve stock",
      rawBlockers,
      dispatchAlreadyFinalized,
      stockConsumptionComplete,
    );
  }

  if (!stockConsumptionComplete && input.stockInput) {
    const stock = projectStockFinalization(input.stockInput);
    if (!stock.canFinalizeConsumption) {
      rawBlockers.push(...stock.blockingReasons);
      return stageResult(
        "stock_finalization",
        "Finalize stock",
        rawBlockers,
        dispatchAlreadyFinalized,
        false,
      );
    }
    return stageResult(
      "stock_finalization",
      "Finalize stock",
      rawBlockers,
      dispatchAlreadyFinalized,
      false,
    );
  }

  if (!stockConsumptionComplete) {
    rawBlockers.push("stock_consumption_pending");
    return stageResult(
      "stock_finalization",
      "Finalize stock",
      rawBlockers,
      dispatchAlreadyFinalized,
      false,
    );
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
  if (stage === "dispatch_finalization" && dispatchAlreadyFinalized) {
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

/** @deprecated use isDispatchEvidencePrepared on slices — kept for tests importing derivation helpers */
export function computeDispatchEvidencePrepared(
  evidenceSlices: ReadinessEvidenceSlice[],
  scan: ReadinessScanSlice,
): boolean {
  return isDispatchEvidencePrepared(evidenceSlices, scan);
}
