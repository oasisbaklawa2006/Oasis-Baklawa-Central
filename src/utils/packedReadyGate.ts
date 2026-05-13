/**
 * Phase 2B — packed_ready eligibility (read-only / client guards). No schema changes.
 * Uses the same finance signal as Packing & Dispatch (advance gap) plus existing line/requisition data.
 */

import { pendingRequisitionQty, type OrderTraceInputs, deriveFinanceVisibility } from "@/utils/orderTrace";

export type PackedReadyBlockerReason =
  | "invalid_order_status"
  | "pending_department"
  | "pending_item_quantity"
  | "requisition_pending"
  | "finance_block";

export interface PackedReadyBlocker {
  reason: PackedReadyBlockerReason;
  message: string;
}

export interface PackedReadyGateItem {
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
}

export type PackedReadyGateOrder = OrderTraceInputs;

export interface PackedReadyGateInput {
  order: PackedReadyGateOrder;
  /** All order lines (not a subset by department). */
  items: PackedReadyGateItem[];
  requisitions: Parameters<typeof pendingRequisitionQty>[0];
}

const TERMINAL_ORDER_STATUSES = new Set([
  "draft",
  "cart",
  "cancelled",
  "delivered",
  "dispatched",
  "in_transit",
  "closed",
]);

/** Already past the packed_ready milestone — cannot freshly mark. */
const AT_OR_AFTER_PACKED_READY = new Set([
  "packed_ready",
  "awaiting_final_payment",
  "awaiting_payment",
  "cleared_for_dispatch",
]);

/** Too early in pipeline to mark packed_ready (operational guard). */
const TOO_EARLY_FOR_PACKED_READY = new Set(["submitted", "confirmed", "awaiting_advance"]);

function norm(s: string | null | undefined) {
  return (s || "").trim().toLowerCase();
}

function isDepartmentSatisfied(item: PackedReadyGateItem, orderStatus: string): boolean {
  const ps = norm(item.production_status);
  if (ps === "completed") return true;
  /** Existing partial workflow: order-level partial_ready + line partial_ready still has shop-floor work for remainder. */
  if (norm(orderStatus) === "partial_ready" && ps === "partial_ready") return true;
  return false;
}

function isQuantitySatisfied(item: PackedReadyGateItem, orderStatus: string): boolean {
  const packed = item.actual_packed_qty ?? 0;
  const need = item.quantity || 0;
  if (packed >= need) return true;
  if (norm(orderStatus) === "partial_ready" && norm(item.production_status) === "partial_ready") return true;
  return false;
}

export interface PackedReadyGateOptions {
  /**
   * transition — applying packed_ready (strict source status).
   * snapshot — read-only / drift: orders already at packed_ready+; skips pipeline-stage rules, keeps ops + finance checks.
   */
  mode?: "transition" | "snapshot";
}

const SNAPSHOT_INVALID_ONLY = new Set(["draft", "cart", "cancelled", "delivered", "dispatched", "in_transit", "closed"]);

export function getPackedReadyBlockers(input: PackedReadyGateInput, options?: PackedReadyGateOptions): PackedReadyBlocker[] {
  const mode = options?.mode ?? "transition";
  const blockers: PackedReadyBlocker[] = [];
  const st = norm(input.order.status);

  if (mode === "snapshot") {
    if (!st || SNAPSHOT_INVALID_ONLY.has(st)) {
      blockers.push({
        reason: "invalid_order_status",
        message: st === "draft"
          ? "invalid order status: draft"
          : `invalid order status: ${input.order.status}`,
      });
    }
  } else {
    if (!st || TERMINAL_ORDER_STATUSES.has(st)) {
      blockers.push({
        reason: "invalid_order_status",
        message:
          st === "draft"
            ? "invalid order status: draft orders cannot be marked packed_ready"
            : st === "cancelled"
              ? "invalid order status: cancelled orders cannot be marked packed_ready"
              : `invalid order status: ${input.order.status} cannot be marked packed_ready`,
      });
    } else if (AT_OR_AFTER_PACKED_READY.has(st)) {
      blockers.push({
        reason: "invalid_order_status",
        message: "invalid order status: order is already packed_ready or later in the pipeline",
      });
    } else if (TOO_EARLY_FOR_PACKED_READY.has(st)) {
      blockers.push({
        reason: "invalid_order_status",
        message: "invalid order status: confirm production / packing has started before packed_ready",
      });
    }
  }

  const fin = deriveFinanceVisibility(input.order);
  if (fin.awaiting_advance) {
    blockers.push({
      reason: "finance_block",
      message: "finance block: advance required before marking packed_ready",
    });
  } else {
    const advReq = input.order.advance_required ?? 0;
    const advPaid = input.order.advance_paid ?? 0;
    if (advReq > 0 && advPaid < advReq) {
      blockers.push({
        reason: "finance_block",
        message: "finance block: recorded advance is below required advance",
      });
    }
  }

  const reqPend = pendingRequisitionQty(input.requisitions);
  if (reqPend.pendingUnits > 0) {
    blockers.push({
      reason: "requisition_pending",
      message: `requisition pending: ${reqPend.pendingUnits} unit(s) still open on store requisitions`,
    });
  }

  const items = input.items || [];
  if (items.length === 0) {
    blockers.push({
      reason: "pending_item_quantity",
      message: "pending item quantity: order has no line items",
    });
  }

  for (const it of items) {
    if (!isDepartmentSatisfied(it, input.order.status)) {
      blockers.push({
        reason: "pending_department",
        message: "pending department: one or more lines still have production work open",
      });
      break;
    }
  }

  for (const it of items) {
    if (!isQuantitySatisfied(it, input.order.status)) {
      blockers.push({
        reason: "pending_item_quantity",
        message: "pending item quantity: packed quantity is below ordered quantity on one or more lines",
      });
      break;
    }
  }

  return blockers;
}

export function canMarkPackedReady(input: PackedReadyGateInput, options?: PackedReadyGateOptions): boolean {
  return getPackedReadyBlockers(input, options).length === 0;
}

export function packedReadyBlockerMessages(blockers: PackedReadyBlocker[]): string[] {
  return blockers.map((b) => b.message);
}
