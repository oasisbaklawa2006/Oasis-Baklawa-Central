import { DispatchFinalizationError } from "./dispatchFinalizationTypes";

export function requireReversalReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new DispatchFinalizationError("reason_required", "Dispatch reversal requires reversalReason");
  }
  return trimmed;
}

/** Reversal records compensating lineage only — does not delete prior rows or auto-restock. */
export function deriveReversalTargetStatus(currentStatus: string): string {
  const normalized = currentStatus.trim().toLowerCase();
  if (normalized === "dispatched") return "cleared_for_dispatch";
  return currentStatus;
}

export function assertReversalAllowed(currentStatus: string): void {
  const normalized = currentStatus.trim().toLowerCase();
  if (normalized !== "dispatched" && normalized !== "in_transit") {
    throw new DispatchFinalizationError(
      "not_eligible",
      `Reversal only applies after dispatch finalization (status: ${currentStatus})`,
    );
  }
}
