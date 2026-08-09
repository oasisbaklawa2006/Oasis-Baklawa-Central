/**
 * Phase 2C — finance release visibility (read-only derivation). No schema changes.
 * Aligns advance/balance signals with packedReadyGate / orderTrace helpers.
 */

import { deriveFinanceVisibility, type FinanceTraceVisibility, type OrderTraceInputs } from "@/utils/orderTrace";

const TERMINAL_PIPELINE = new Set([
  "draft",
  "cart",
  "cancelled",
  "delivered",
  "dispatched",
  "in_transit",
  "closed",
]);

function norm(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Advance / finance path cleared for operations without requiring advance_paid ≥ advance_required.
 * Includes full settlement (`paid`) — e.g. PI wallet auto-deduct can set paid without bumping advance_paid.
 */
export function isAdvanceVerificationPathCleared(order: OrderTraceInputs): boolean {
  const ps = norm(order.payment_status);
  return (
    ps === "paid" ||
    ps === "short_term_credit" ||
    ps === "verified_advance" ||
    ps === "advance_paid" ||
    ps === "on_credit"
  );
}

/** Same finance signal as packed_ready gate for advance (plus credit/verified paths). */
export function operationsFinanceHold(order: OrderTraceInputs): boolean {
  const st = norm(order.status);
  if (TERMINAL_PIPELINE.has(st)) return false;
  if (isAdvanceVerificationPathCleared(order)) return false;
  const vis = deriveFinanceVisibility(order);
  if (vis.awaiting_advance) return true;
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  if (advReq > 0 && advPaid < advReq) return true;
  return false;
}

const BALANCE_DISPATCH_STATUSES = new Set(["cleared_for_dispatch", "awaiting_final_payment", "awaiting_payment"]);

/**
 * Blocks dispatch handoff when advance is not cleared, or when balance is still due at a dispatch-critical status.
 */
export function dispatchFinanceHold(order: OrderTraceInputs): boolean {
  const st = norm(order.status);
  if (TERMINAL_PIPELINE.has(st)) return false;
  if (operationsFinanceHold(order)) return true;
  const vis = deriveFinanceVisibility(order);
  if (vis.balance_pending && BALANCE_DISPATCH_STATUSES.has(st)) return true;
  return false;
}

export interface FinanceReleaseState extends FinanceTraceVisibility {
  outstanding_balance: number;
  finance_hold_operations: boolean;
  finance_hold_dispatch: boolean;
  /** Either lane blocked (union). */
  finance_hold: boolean;
  /** Advance / credit path allows shop-floor work (negation of operations hold). */
  finance_released_operations: boolean;
  /** Balance + advance allow dispatch actions (negation of dispatch hold). */
  finance_released_dispatch: boolean;
  /** Chip: no finance hold on active orders, or shipment-complete terminals. */
  finance_released: boolean;
  is_terminal_pipeline: boolean;
}

export function deriveFinanceReleaseState(order: OrderTraceInputs): FinanceReleaseState {
  const vis = deriveFinanceVisibility(order);
  const total = order.sales_order_value ?? 0;
  const advPaid = order.advance_paid ?? 0;
  const outstanding_balance = Math.max(0, total - advPaid);

  const st = norm(order.status);
  const is_terminal_pipeline = TERMINAL_PIPELINE.has(st);

  const finance_hold_operations = operationsFinanceHold(order);
  const finance_hold_dispatch = dispatchFinanceHold(order);
  const finance_hold = finance_hold_operations || finance_hold_dispatch;

  const finance_released_operations = !finance_hold_operations;
  const finance_released_dispatch = !finance_hold_dispatch;

  const deadSpent = st === "cancelled" || st === "draft" || st === "cart";
  const shippedDone = st === "dispatched" || st === "in_transit" || st === "delivered" || st === "closed";
  const finance_released = shippedDone || (!deadSpent && !finance_hold);

  return {
    ...vis,
    outstanding_balance,
    finance_hold_operations,
    finance_hold_dispatch,
    finance_hold,
    finance_released_operations,
    finance_released_dispatch,
    finance_released,
    is_terminal_pipeline,
  };
}

export type FinanceReleaseBlocker = {
  code: string;
  message: string;
  scope: "operations" | "dispatch";
};

export function getFinanceReleaseBlockers(order: OrderTraceInputs): FinanceReleaseBlocker[] {
  const blockers: FinanceReleaseBlocker[] = [];
  const st = norm(order.status);
  if (TERMINAL_PIPELINE.has(st)) return blockers;

  if (operationsFinanceHold(order)) {
    const vis = deriveFinanceVisibility(order);
    const advReq = order.advance_required ?? 0;
    const advPaid = order.advance_paid ?? 0;
    if (vis.awaiting_advance && st === "awaiting_advance") {
      blockers.push({
        code: "awaiting_advance_status",
        message: "Order status is awaiting advance — verify receipt or credit-release before production/packing.",
        scope: "operations",
      });
    } else if (advReq > 0 && advPaid < advReq) {
      blockers.push({
        code: "advance_below_required",
        message: `Advance gap: recorded ₹${advPaid.toLocaleString("en-IN")} vs required ₹${advReq.toLocaleString("en-IN")}.`,
        scope: "operations",
      });
    } else {
      blockers.push({
        code: "advance_pending",
        message: "Finance hold: advance or verification still required before operations can rely on this order.",
        scope: "operations",
      });
    }
  }

  if (dispatchFinanceHold(order) && !operationsFinanceHold(order)) {
    const vis = deriveFinanceVisibility(order);
    if (vis.balance_pending && BALANCE_DISPATCH_STATUSES.has(st)) {
      const total = order.sales_order_value ?? 0;
      const advPaid = order.advance_paid ?? 0;
      blockers.push({
        code: "balance_due_dispatch",
        message: `Balance still due (order total ₹${total.toLocaleString("en-IN")}, paid ₹${advPaid.toLocaleString("en-IN")}) — clear payment before dispatch.`,
        scope: "dispatch",
      });
    }
  }

  return blockers;
}

export function canReleaseOrderToOperations(order: OrderTraceInputs): boolean {
  const st = norm(order.status);
  if (TERMINAL_PIPELINE.has(st)) return false;
  return !operationsFinanceHold(order);
}

export function canReleaseOrderToDispatch(order: OrderTraceInputs): boolean {
  const st = norm(order.status);
  if (TERMINAL_PIPELINE.has(st)) return false;
  return !dispatchFinanceHold(order);
}

/** Shared finance clearance for any transition into cleared_for_dispatch. */
function getDispatchClearanceBlockers(order: OrderTraceInputs): string[] {
  const financeBlockers = getFinanceReleaseBlockers(order);
  if (!canReleaseOrderToDispatch(order)) {
    return financeBlockers.length > 0
      ? financeBlockers.map((b) => b.message)
      : ["Finance clearance required before moving to dispatch ready."];
  }

  const total = order.sales_order_value ?? 0;
  const paymentStatus = (order.payment_status ?? "").trim();
  if (total > 0 && !paymentStatus) {
    return [
      "Payment status unknown — verify finance release before advancing to dispatch ready.",
    ];
  }

  return [];
}

const CLEARED_FOR_DISPATCH_FROM_STATUSES = new Set(["packed_ready", "awaiting_final_payment"]);

/**
 * Client guard for transitions into cleared_for_dispatch (Order Management, Packing & Dispatch).
 * Reuses canonical finance release derivation — no independent eligibility rules.
 */
export function getClearedForDispatchTransitionBlockers(
  order: OrderTraceInputs & { status: string },
): string[] {
  const st = norm(order.status);
  if (!CLEARED_FOR_DISPATCH_FROM_STATUSES.has(st)) {
    return [`Cannot clear for dispatch from status ${order.status}.`];
  }
  return getDispatchClearanceBlockers(order);
}

/**
 * Client guard for packed_ready → cleared_for_dispatch (Packing & Dispatch "dispatch ready" queue).
 * Reuses canonical finance release derivation — no independent eligibility rules.
 */
export function getPackedReadyToClearedDispatchBlockers(
  order: OrderTraceInputs & { status: string },
): string[] {
  const st = norm(order.status);
  if (st !== "packed_ready") {
    return ["Order must be packed_ready before moving to dispatch ready."];
  }
  return getDispatchClearanceBlockers(order);
}

export function canAdvancePackedReadyToClearedDispatch(
  order: OrderTraceInputs & { status: string },
): boolean {
  return getPackedReadyToClearedDispatchBlockers(order).length === 0;
}

/**
 * Guard existing verify-advance mutations. Non-empty ⇒ cancel and show messages (toast).
 * Does not replace ₹0 / credit-lock checks in AdminFinance — combine there.
 */
export function getAdvanceVerificationGuardMessages(order: OrderTraceInputs): string[] {
  const reasons: string[] = [];
  const st = norm(order.status);
  const total = order.sales_order_value ?? 0;

  if (total <= 0) {
    reasons.push("Order value is ₹0 — restore total before finance release.");
  }

  if (TERMINAL_PIPELINE.has(st)) {
    reasons.push(`Order is terminal (${order.status}) — advance verification not applicable.`);
  }

  if (!operationsFinanceHold(order)) {
    reasons.push("No finance hold on advance / verification — this release action is not needed.");
  }

  return reasons;
}

/** Guard short-term credit release: non-empty ⇒ cancel (toast). */
export function getShortTermCreditReleaseGuardMessages(order: OrderTraceInputs): string[] {
  const reasons: string[] = [];
  const st = norm(order.status);
  const total = order.sales_order_value ?? 0;

  if (total <= 0) {
    reasons.push("Order value is ₹0 — cannot issue short-term credit release.");
  }

  if (TERMINAL_PIPELINE.has(st)) {
    reasons.push(`Order is terminal (${order.status}) — short-term credit not applicable.`);
  }

  if (isAdvanceVerificationPathCleared(order)) {
    reasons.push("Order already has verified advance or credit on file.");
  }

  if (!operationsFinanceHold(order)) {
    reasons.push("No advance hold — short-term credit release is not needed.");
  }

  return reasons;
}
