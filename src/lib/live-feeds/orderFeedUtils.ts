import type { OrderTraceInputs } from "@/utils/orderTrace";
import { deriveFinanceReleaseState } from "@/utils/financeReleaseState";
import { isDispatchPanicFromUrgency } from "@/lib/order-priority-owner-sla";
import type { OperationalOrderFeedRow } from "./feedTypes";

export function orderTraceInputs(row: OperationalOrderFeedRow): OrderTraceInputs {
  return {
    status: row.status,
    payment_status: row.payment_status ?? null,
    advance_paid: row.advance_paid ?? null,
    advance_required: row.advance_required ?? null,
    sales_order_value: row.sales_order_value ?? null,
  };
}

export function isFinanceHoldOrder(row: OperationalOrderFeedRow): boolean {
  return deriveFinanceReleaseState(orderTraceInputs(row)).finance_hold;
}

export function isDispatchPanicOrder(row: OperationalOrderFeedRow): boolean {
  return isDispatchPanicFromUrgency(row.dispatch_urgency);
}

export function isTriageReviewOrder(row: OperationalOrderFeedRow): boolean {
  const lowConf = typeof row.min_confidence === "number" && row.min_confidence < 0.9;
  const unmapped =
    !row.company_id ||
    row.company_status === "shadow" ||
    !row.company_name ||
    /unknown/i.test(row.company_name || "");
  return !!(lowConf || unmapped || row.needs_clarification || row.is_duplicate);
}

const PRODUCTION_STATUSES = new Set(["manufacturing", "in_production", "assembly", "partial_ready", "submitted"]);

const ASSEMBLY_STATUSES = new Set(["assembly", "partial_ready", "packed_ready"]);

const DISPATCH_STATUSES = new Set([
  "packed_ready",
  "awaiting_final_payment",
  "awaiting_payment",
  "cleared_for_dispatch",
]);

export function isProductionPipelineOrder(row: OperationalOrderFeedRow): boolean {
  const st = (row.status || "").toLowerCase();
  return PRODUCTION_STATUSES.has(st) && !isFinanceHoldOrder(row);
}

export function isAssemblyPipelineOrder(row: OperationalOrderFeedRow): boolean {
  const st = (row.status || "").toLowerCase();
  return ASSEMBLY_STATUSES.has(st);
}

export function isDispatchPipelineOrder(row: OperationalOrderFeedRow): boolean {
  const st = (row.status || "").toLowerCase();
  return DISPATCH_STATUSES.has(st) || isDispatchPanicOrder(row);
}

export function isReadyGoodsPipelineOrder(row: OperationalOrderFeedRow): boolean {
  return (row.status || "").toLowerCase() === "packed_ready";
}

export function agingHoursFromCreatedAt(createdAt: string | null): number | undefined {
  if (!createdAt) return undefined;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms > 0 ? Math.floor(ms / (1000 * 60 * 60)) : undefined;
}

export function soLabel(orderId: string): string {
  return `SO-${orderId.slice(0, 8).toUpperCase()}`;
}
