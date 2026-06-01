/**
 * Staff-facing golden chain stage derivation (Phase 24A).
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
  "needs_readiness",
  "needs_finance_release",
  "needs_completion_attestation",
  "needs_dispatch_finalization",
  "needs_reservation",
  "needs_stock_finalization",
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
  "4b_readiness": "needs_readiness",
  "4c_finance": "needs_finance_release",
  "4d_completion": "needs_completion_attestation",
  "4e_dispatch_finalization": "needs_dispatch_finalization",
  "4f_reservation": "needs_reservation",
  "4g_stock": "needs_stock_finalization",
  complete: "complete",
};

const STAFF_LABELS: Record<GoldenChainStaffStage, string> = {
  needs_readiness: "Dispatch check",
  needs_finance_release: "Finance approval",
  needs_completion_attestation: "Completion confirmation",
  needs_dispatch_finalization: "Dispatch finalize",
  needs_reservation: "Reserve stock",
  needs_stock_finalization: "Deduct stock",
  complete: "Done",
  blocked: "Blocked",
  already_finalized: "Dispatch already finalized",
  inconsistent_state: "Needs supervisor review",
};

const ROLE_BY_STAFF: Record<GoldenChainStaffStage, GoldenChainRequiredRole> = {
  needs_readiness: "dispatch",
  needs_finance_release: "finance",
  needs_completion_attestation: "dispatch",
  needs_dispatch_finalization: "dispatch",
  needs_reservation: "inventory",
  needs_stock_finalization: "inventory",
  complete: "none",
  blocked: "supervisor",
  already_finalized: "none",
  inconsistent_state: "supervisor",
};

const LAST_SUCCESS: Partial<Record<GoldenChainStaffStage, GoldenChainStaffStage>> = {
  needs_finance_release: "needs_readiness",
  needs_completion_attestation: "needs_finance_release",
  needs_dispatch_finalization: "needs_completion_attestation",
  needs_reservation: "needs_dispatch_finalization",
  needs_stock_finalization: "needs_reservation",
  complete: "needs_stock_finalization",
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
    internal.stage === "4e_dispatch_finalization" &&
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
