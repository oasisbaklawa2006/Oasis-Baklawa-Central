import type { OrderChangeAction } from "@/lib/order-authority/orderAmendmentAuthorityTypes";

/** Terminal states — no further governed change requests. */
export const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "delivered", "closed"]);

/** Post-dispatch execution — Core must apply compensating closure, not Central shadow edits. */
export const IRREVERSIBLE_EXECUTION_STATUSES = new Set(["dispatched", "delivered", "closed", "cancelled"]);

const AMENDMENT_ALLOWED_STATUSES = new Set([
  "submitted",
  "confirmed",
  "awaiting_advance",
  "manufacturing",
  "in_production",
  "assembled",
  "packing",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
]);

const SUBSTITUTION_ALLOWED_STATUSES = new Set([
  "submitted",
  "confirmed",
  "awaiting_advance",
  "manufacturing",
  "in_production",
  "assembled",
  "packing",
]);

const CANCELLATION_ALLOWED_STATUSES = new Set(AMENDMENT_ALLOWED_STATUSES);

export function isOrderChangeActionEligible(action: OrderChangeAction, status: string): boolean {
  if (TERMINAL_ORDER_STATUSES.has(status) || status === "dispatched") return false;
  if (action === "amend") return AMENDMENT_ALLOWED_STATUSES.has(status);
  if (action === "substitute") return SUBSTITUTION_ALLOWED_STATUSES.has(status);
  if (action === "cancel") return CANCELLATION_ALLOWED_STATUSES.has(status);
  return false;
}

export function orderChangeActionDisabledReason(action: OrderChangeAction, status: string): string {
  if (isOrderChangeActionEligible(action, status)) return "";
  if (TERMINAL_ORDER_STATUSES.has(status)) {
    return `Order is ${status} — governed ${action} is closed.`;
  }
  if (status === "dispatched") {
    return "Order is dispatched — governed change requires Core compensating closure, not Central shadow mutation.";
  }
  return `Governed ${action} is not available at status ${status.replace(/_/g, " ")}.`;
}
