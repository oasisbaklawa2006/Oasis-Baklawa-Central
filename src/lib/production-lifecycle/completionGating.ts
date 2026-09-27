import { COMPLETION_OVERAGE_TOLERANCE } from "./types";

export type CompletionEvidenceInput = {
  producedQty: number;
  wastedQty: number;
  assignedQty: number;
};

export type CompletionGateResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Client-side completion gate mirroring Core's produced+wasted <= assigned*1.1
 * guard on declare_production_ready. Core remains authoritative; this prevents
 * obviously invalid completion attempts from reaching the network.
 */
export function evaluateCompletionGate(input: CompletionEvidenceInput): CompletionGateResult {
  const { producedQty, wastedQty, assignedQty } = input;

  if (!Number.isFinite(producedQty) || producedQty <= 0) {
    return { allowed: false, reason: "Produced quantity must be greater than zero." };
  }

  if (!Number.isFinite(wastedQty) || wastedQty < 0) {
    return { allowed: false, reason: "Wasted quantity cannot be negative." };
  }

  if (!Number.isFinite(assignedQty) || assignedQty <= 0) {
    return { allowed: false, reason: "Assigned target quantity is missing or invalid." };
  }

  const total = producedQty + wastedQty;
  const ceiling = assignedQty * (1 + COMPLETION_OVERAGE_TOLERANCE);
  if (total > ceiling) {
    return {
      allowed: false,
      reason: `Produced + wasted (${total}) exceeds assigned target (${assignedQty}) by more than ${COMPLETION_OVERAGE_TOLERANCE * 100}%.`,
    };
  }

  return { allowed: true };
}

export function assertPauseReasonProvided(reason: string | null | undefined): void {
  if (!reason || !reason.trim()) {
    throw new Error("Pause reason is required before pause_production_job may be called.");
  }
}
