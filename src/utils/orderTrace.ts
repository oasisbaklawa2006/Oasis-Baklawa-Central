/**
 * Read-only helpers for Order Trace (Phase 2A). No DB writes.
 */

export type DispatchTraceBucket = "not_ready" | "partially_ready" | "packed_ready" | "dispatched";

export interface FinanceTraceVisibility {
  awaiting_advance: boolean;
  advance_verified: boolean;
  balance_pending: boolean;
}

export interface OrderTraceInputs {
  status: string;
  payment_status: string | null;
  advance_paid: number | null;
  advance_required: number | null;
  sales_order_value: number | null;
}

export function deriveFinanceVisibility(order: OrderTraceInputs): FinanceTraceVisibility {
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  const total = order.sales_order_value ?? 0;
  const awaitingAdvance = order.status === "awaiting_advance" || (advReq > 0 && advPaid < advReq);
  const advanceVerified = advReq > 0 && advPaid >= advReq;
  const balancePending =
    order.payment_status !== "paid" &&
    total > advPaid &&
    (advReq === 0 || advPaid >= advReq);
  return {
    awaiting_advance: awaitingAdvance,
    advance_verified: advanceVerified,
    balance_pending: balancePending,
  };
}

export function deriveDispatchBucket(
  orderStatus: string,
  lines: { quantity: number; actual_packed_qty: number | null }[],
): DispatchTraceBucket {
  if (["dispatched", "delivered", "in_transit"].includes(orderStatus)) return "dispatched";
  if (
    ["packed_ready", "awaiting_final_payment", "awaiting_payment", "cleared_for_dispatch"].includes(orderStatus)
  ) {
    return "packed_ready";
  }
  const totalOrdered = lines.reduce((s, l) => s + (l.quantity || 0), 0);
  const totalPacked = lines.reduce((s, l) => s + (l.actual_packed_qty ?? 0), 0);
  if (totalOrdered <= 0) return "not_ready";
  if (totalPacked >= totalOrdered) return "packed_ready";
  if (totalPacked > 0) return "partially_ready";
  return "not_ready";
}

export interface DeptLineAggregate {
  deptKey: string;
  lines: number;
  orderedQty: number;
  packedQty: number;
  pendingQty: number;
  productionSummary: string;
}

export function aggregateDepartmentLines(
  items: {
    quantity: number;
    actual_packed_qty: number | null;
    production_status: string | null;
    department?: string | null;
    product?: { department: string | null; production_department: string | null; name: string | null } | null;
  }[],
): DeptLineAggregate[] {
  const map = new Map<
    string,
    { lines: number; orderedQty: number; packedQty: number; statuses: Record<string, number> }
  >();

  for (const it of items) {
    const raw =
      it.product?.production_department ||
      it.product?.department ||
      it.department ||
      it.product?.name ||
      "Unassigned";
    const deptKey = raw.trim() || "Unassigned";
    if (!map.has(deptKey)) {
      map.set(deptKey, { lines: 0, orderedQty: 0, packedQty: 0, statuses: {} });
    }
    const row = map.get(deptKey)!;
    row.lines += 1;
    row.orderedQty += it.quantity || 0;
    row.packedQty += it.actual_packed_qty ?? 0;
    const ps = (it.production_status || "—").trim() || "—";
    row.statuses[ps] = (row.statuses[ps] || 0) + 1;
  }

  return [...map.entries()].map(([deptKey, v]) => {
    const parts = Object.entries(v.statuses)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k}:${n}`);
    return {
      deptKey,
      lines: v.lines,
      orderedQty: v.orderedQty,
      packedQty: v.packedQty,
      pendingQty: Math.max(0, v.orderedQty - v.packedQty),
      productionSummary: parts.join(" · ") || "—",
    };
  });
}

export function pendingRequisitionQty(
  requisitions: {
    status: string | null;
    store_requisition_items?: {
      requested_qty: number;
      fulfilled_qty: number | null;
    }[];
  }[],
): { pendingLines: number; pendingUnits: number } {
  let pendingLines = 0;
  let pendingUnits = 0;
  for (const r of requisitions) {
    if ((r.status || "").toLowerCase() === "cancelled") continue;
    for (const li of r.store_requisition_items || []) {
      const req = li.requested_qty || 0;
      const ful = li.fulfilled_qty ?? 0;
      const pend = Math.max(0, req - ful);
      if (pend > 0) {
        pendingLines += 1;
        pendingUnits += pend;
      }
    }
  }
  return { pendingLines, pendingUnits };
}

export function deriveResponsibleDepartment(params: {
  orderStatus: string;
  pendingReqUnits: number;
  jobs: { status: string; department: string }[];
  linesPackedRatio: number;
}): string {
  const { orderStatus, pendingReqUnits, jobs, linesPackedRatio } = params;
  if (orderStatus === "awaiting_advance") return "Finance — awaiting advance";
  if (pendingReqUnits > 0) return "Store — requisition fulfilment";
  const openJob = jobs.find((j) =>
    ["pending", "accepted", "in_production", "paused"].includes((j.status || "").toLowerCase()),
  );
  if (openJob) return `${openJob.department.replace(/_/g, " ")} — production job`;
  if (["manufacturing", "in_production", "assembled", "partial_ready", "assembly"].includes(orderStatus)) {
    return "Production / assembly floor";
  }
  if (["packing"].includes(orderStatus) || (linesPackedRatio > 0 && linesPackedRatio < 1)) {
    return "Packing & assembly";
  }
  if (["awaiting_final_payment", "awaiting_payment"].includes(orderStatus)) return "Finance — final payment";
  if (orderStatus === "cleared_for_dispatch") return "Dispatch — cleared for gate";
  if (["dispatched", "in_transit"].includes(orderStatus)) return "Logistics — in transit";
  if (orderStatus === "delivered") return "Support — post-delivery window";
  return "Operations — review";
}

/** UX timeline labels (read-only hint, not DB statuses). */
export const ORDER_TRACE_TIMELINE_LABELS = [
  "Order Placed",
  "Awaiting Advance",
  "Advance Verified",
  "Operations Review",
  "Department Allocation",
  "Production/Store Processing",
  "Packing & Assembly",
  "Packed Ready",
  "Invoice/Dispatch",
  "Dispatched",
  "Delivered",
  "10-day Support Window",
] as const;

export type TimelineStepState = "done" | "current" | "upcoming";

/** Single cursor index into ORDER_TRACE_TIMELINE_LABELS (0-based). */
export function computeTimelineCursor(
  order: OrderTraceInputs,
  pendingReqUnits: number,
  hasOpenProductionJobs: boolean,
  linesPackedRatio: number,
): number {
  const labelsLen = ORDER_TRACE_TIMELINE_LABELS.length;
  const st = order.status;
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  const advanceDone = advReq <= 0 || advPaid >= advReq;

  if (st === "cancelled") return 0;

  const statusCursor: Record<string, number> = {
    cart: 0,
    draft: 0,
    submitted: 0,
    awaiting_advance: 1,
    confirmed: 3,
    approved: 3,
    manufacturing: 5,
    in_production: 5,
    assembly: 5,
    partial_ready: 5,
    assembled: 6,
    packing: 6,
    packed_ready: 7,
    awaiting_final_payment: 8,
    awaiting_payment: 8,
    cleared_for_dispatch: 8,
    dispatched: 9,
    in_transit: 9,
    delivered: 11,
  };

  let cur = statusCursor[st] ?? 4;

  if (!advanceDone) cur = Math.min(cur, 1);
  else cur = Math.max(cur, 2);

  if (pendingReqUnits > 0) cur = Math.max(cur, 4);
  if (hasOpenProductionJobs || ["manufacturing", "in_production", "assembly", "partial_ready"].includes(st)) {
    cur = Math.max(cur, 5);
  }
  if (["assembled", "packing"].includes(st) || (linesPackedRatio > 0 && linesPackedRatio < 1)) {
    cur = Math.max(cur, 6);
  }
  if (st === "packed_ready" || linesPackedRatio >= 1) cur = Math.max(cur, 7);
  if (["awaiting_final_payment", "awaiting_payment", "cleared_for_dispatch"].includes(st)) {
    cur = Math.max(cur, 8);
  }
  if (["dispatched", "in_transit"].includes(st)) cur = Math.max(cur, 9);

  return Math.min(Math.max(cur, 0), labelsLen - 1);
}

export function buildTimelineSteps(
  order: OrderTraceInputs,
  pendingReqUnits: number,
  hasOpenProductionJobs: boolean,
  linesPackedRatio: number,
): { label: string; state: TimelineStepState }[] {
  const cursor = computeTimelineCursor(order, pendingReqUnits, hasOpenProductionJobs, linesPackedRatio);
  return ORDER_TRACE_TIMELINE_LABELS.map((label, i) => {
    let state: TimelineStepState = "upcoming";
    if (i < cursor) state = "done";
    else if (i === cursor) state = "current";
    return { label, state };
  });
}

/** Known raw `orders.status` values for locator filters (aligned with app usage). */
export const ORDER_LOCATOR_RAW_STATUSES = [
  "cart",
  "draft",
  "submitted",
  "confirmed",
  "approved",
  "awaiting_advance",
  "manufacturing",
  "in_production",
  "assembly",
  "assembled",
  "partial_ready",
  "packing",
  "packed_ready",
  "awaiting_final_payment",
  "awaiting_payment",
  "cleared_for_dispatch",
  "dispatched",
  "in_transit",
  "delivered",
  "cancelled",
  "closed",
] as const;

export type OrderLocatorDerivedBucket =
  | "finance_awaiting_advance"
  | "finance_advance_verified"
  | "finance_balance_pending"
  | "dispatch_not_ready"
  | "dispatch_partially_ready"
  | "dispatch_packed_ready"
  | "dispatch_dispatched";

export type TraceLineLite = {
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department?: string | null;
  product?: { department: string | null; production_department: string | null; name: string | null } | null;
};

export type TraceReqLite = {
  status: string | null;
  store_requisition_items?: { requested_qty: number; fulfilled_qty: number | null }[];
};

export type TraceJobLite = { status: string; department: string };

export interface OrderTracePreview {
  finance: FinanceTraceVisibility;
  dispatch: DispatchTraceBucket;
  responsible: string;
  pendingLineCount: number;
  pendingUnitTotal: number;
  requisitionPendingLines: number;
  requisitionPendingUnits: number;
}

/** Snapshot derived trace fields for search results (read-only). */
export function buildOrderTracePreview(
  order: OrderTraceInputs,
  items: TraceLineLite[],
  requisitions: TraceReqLite[],
  jobs: TraceJobLite[],
): OrderTracePreview {
  const finance = deriveFinanceVisibility(order);
  const dispatch = deriveDispatchBucket(order.status, items);
  const reqPending = pendingRequisitionQty(requisitions);
  const totalOrdered = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalPacked = items.reduce((s, i) => s + (i.actual_packed_qty ?? 0), 0);
  const linesPackedRatio = totalOrdered > 0 ? totalPacked / totalOrdered : 0;
  const responsible = deriveResponsibleDepartment({
    orderStatus: order.status,
    pendingReqUnits: reqPending.pendingUnits,
    jobs,
    linesPackedRatio,
  });

  let pendingLineCount = 0;
  let pendingUnitTotal = 0;
  for (const it of items) {
    const pend = Math.max(0, (it.quantity || 0) - (it.actual_packed_qty ?? 0));
    if (pend > 0) {
      pendingLineCount += 1;
      pendingUnitTotal += pend;
    }
  }

  return {
    finance,
    dispatch,
    responsible,
    pendingLineCount,
    pendingUnitTotal,
    requisitionPendingLines: reqPending.pendingLines,
    requisitionPendingUnits: reqPending.pendingUnits,
  };
}

export function matchesLocatorDerivedBucket(preview: OrderTracePreview, filter: OrderLocatorDerivedBucket): boolean {
  switch (filter) {
    case "finance_awaiting_advance":
      return preview.finance.awaiting_advance;
    case "finance_advance_verified":
      return preview.finance.advance_verified;
    case "finance_balance_pending":
      return preview.finance.balance_pending;
    case "dispatch_not_ready":
      return preview.dispatch === "not_ready";
    case "dispatch_partially_ready":
      return preview.dispatch === "partially_ready";
    case "dispatch_packed_ready":
      return preview.dispatch === "packed_ready";
    case "dispatch_dispatched":
      return preview.dispatch === "dispatched";
    default:
      return false;
  }
}
