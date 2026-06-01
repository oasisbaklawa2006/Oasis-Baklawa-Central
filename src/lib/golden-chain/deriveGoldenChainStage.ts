/**
 * Staff-facing golden chain stage derivation (Phase 24A / 24D).
 * Wraps governed projections in `golden-chain-operator` without bypassing services.
 */
import {
  deriveGoldenChainStage as deriveInternalStage,
  type GoldenChainDerivationInput,
  type GoldenChainDerivationResult,
} from "@/lib/golden-chain-operator/goldenChainStageDerivation";
import { hasGovernedDispatchFinalizeLineage } from "@/lib/golden-chain-operator/goldenChainDuplicateGuards";
import type { GoldenChainCtaLabel, GoldenChainStage } from "@/lib/golden-chain-operator/goldenChainTypes";

export const GOLDEN_CHAIN_STAFF_STAGES = [
  "prepare_dispatch_evidence",
  "finance_release",
  "readiness_review",
  "completion_attestation",
  "dispatch_finalization",
  "reservation",
  "stock_finalization",
  "complete",
  "blocked",
  "already_finalized",
  "inconsistent_state",
] as const;

export type GoldenChainStaffStage = (typeof GOLDEN_CHAIN_STAFF_STAGES)[number];

export type GoldenChainRequiredRole =
  | "dispatch"
  | "finance"
  | "inventory"
  | "supervisor"
  | "none";

const INTERNAL_TO_STAFF: Record<GoldenChainStage, GoldenChainStaffStage> = {
  prepare_dispatch_evidence: "prepare_dispatch_evidence",
  finance_release: "finance_release",
  readiness_review: "readiness_review",
  completion_attestation: "completion_attestation",
  dispatch_finalization: "dispatch_finalization",
  reservation: "reservation",
  stock_finalization: "stock_finalization",
  complete: "complete",
};

const STAFF_LABELS: Record<GoldenChainStaffStage, string> = {
  prepare_dispatch_evidence: "Prepare evidence",
  finance_release: "Finance approval",
  readiness_review: "Readiness review",
  completion_attestation: "Completion",
  dispatch_finalization: "Dispatch finalize",
  reservation: "Reserve stock",
  stock_finalization: "Deduct stock",
  complete: "Done",
  blocked: "Blocked",
  already_finalized: "Dispatch already finalized",
  inconsistent_state: "Needs supervisor review",
};

const ROLE_BY_STAFF: Record<GoldenChainStaffStage, GoldenChainRequiredRole> = {
  prepare_dispatch_evidence: "dispatch",
  finance_release: "finance",
  readiness_review: "dispatch",
  completion_attestation: "dispatch",
  dispatch_finalization: "dispatch",
  reservation: "inventory",
  stock_finalization: "inventory",
  complete: "none",
  blocked: "supervisor",
  already_finalized: "none",
  inconsistent_state: "supervisor",
};

const LAST_SUCCESS: Partial<Record<GoldenChainStaffStage, GoldenChainStaffStage>> = {
  finance_release: "prepare_dispatch_evidence",
  readiness_review: "finance_release",
  completion_attestation: "readiness_review",
  dispatch_finalization: "completion_attestation",
  reservation: "dispatch_finalization",
  stock_finalization: "reservation",
  complete: "stock_finalization",
};

export interface GoldenChainStaffDerivation {
  currentStage: GoldenChainStaffStage;
  nextAction: GoldenChainCtaLabel;
  isComplete: boolean;
  blockers: string[];
  warnings: string[];
  allowedActions: GoldenChainCtaLabel[];
  requiredRole: GoldenChainRequiredRole;
  lastSuccessfulStage: GoldenChainStaffStage | null;
  staffStageLabel: string;
  internalStage: GoldenChainStage;
  dispatchAlreadyFinalized: boolean;
  stockConsumptionComplete: boolean;
}

function detectInconsistent(input: GoldenChainDerivationInput, internal: GoldenChainDerivationResult): boolean {
  const finalized = hasGovernedDispatchFinalizeLineage(input.dispatchLineage);
  const status = input.finalizationInput.currentOrderStatus.trim().toLowerCase();
  if (finalized && !["dispatched", "in_transit", "delivered"].includes(status)) {
    return true;
  }
  if (internal.stockConsumptionComplete && internal.stage !== "complete") {
    return true;
  }
  return false;
}

export function deriveGoldenChainStaffStage(
  input: GoldenChainDerivationInput,
): GoldenChainStaffDerivation {
  const internal = deriveInternalStage(input);
  const dispatchAlreadyFinalized = internal.dispatchAlreadyFinalized;

  let currentStage = INTERNAL_TO_STAFF[internal.stage];
  const warnings: string[] = [];

  if (detectInconsistent(input, internal)) {
    currentStage = "inconsistent_state";
    warnings.push("Order status and dispatch records do not match. Ask a supervisor before continuing.");
  } else if (
    internal.stage === "dispatch_finalization" &&
    dispatchAlreadyFinalized
  ) {
    currentStage = "already_finalized";
  }

  const isComplete = currentStage === "complete";
  const nextAction = internal.cta;
  const allowedActions: GoldenChainCtaLabel[] = isComplete || currentStage === "already_finalized"
    ? ["Already complete"]
    : [nextAction];

  return {
    currentStage,
    nextAction,
    isComplete,
    blockers: internal.rawBlockers,
    warnings,
    allowedActions,
    requiredRole: ROLE_BY_STAFF[currentStage],
    lastSuccessfulStage: LAST_SUCCESS[currentStage] ?? null,
    staffStageLabel: STAFF_LABELS[currentStage],
    internalStage: internal.stage,
    dispatchAlreadyFinalized,
    stockConsumptionComplete: internal.stockConsumptionComplete,
  };
}

export { deriveInternalStage as deriveGoldenChainStageInternal };
export type { GoldenChainDerivationInput, GoldenChainDerivationResult };
