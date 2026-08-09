/** Status targets that Order Management may dispatch via governed authority RPCs. */
export const GOVERNED_DIRECT_STATUSES = new Set([
  "in_production",
  "packed_ready",
  "cleared_for_dispatch",
  "awaiting_advance",
]);

/**
 * Whether the primary status-action button should be enabled on Order Management.
 * submitted → confirmed is remapped to awaiting_advance (prepaid) or in_production (credit) before dispatch.
 */
export function isGovernedOrderActionAvailable(status: string, next: string): boolean {
  if (status === "submitted" && next === "confirmed") return true;
  return GOVERNED_DIRECT_STATUSES.has(next);
}

export function governedOrderActionDisabledReason(status: string, next: string): string {
  if (isGovernedOrderActionAvailable(status, next)) return "";
  return `Transition to ${next.replace(/_/g, " ")} is not available here — use the governed finance/operations workflow.`;
}
