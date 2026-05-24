import type { DispatchTraceBucket, FinanceTraceVisibility, TimelineStepState } from "@/utils/orderTrace";
import { normalizeOperationalTimestamp } from "./normalize";
import { OperationalEventKind, type OperationalEventRecord } from "./types";

const SOURCE = "derived_order_trace" as const;

function orderEntity(orderId: string) {
  return [{ entityType: "order" as const, id: orderId }];
}

/**
 * Builds a read-only operational feed from an order trace snapshot.
 * Does not query the network and does not persist events.
 */
export function buildOrderOperationalFeedFromTrace(input: {
  orderId: string;
  createdAt: string | null;
  financeVerifiedAt: string | null;
  orderStatus: string;
  paymentStatus: string | null;
  finance: FinanceTraceVisibility;
  dispatchBucket: DispatchTraceBucket;
  pendingReq: { pendingLines: number; pendingUnits: number };
  requisitionCount: number;
  jobs: { id: string; department: string; status: string }[];
  timelineSteps: { label: string; state: TimelineStepState }[];
  totalOrdered: number;
  totalPacked: number;
}): OperationalEventRecord[] {
  const { orderId } = input;
  const out: OperationalEventRecord[] = [];

  const createdIso = normalizeOperationalTimestamp(input.createdAt);
  if (createdIso) {
    out.push({
      id: `oe:${orderId}:order.created`,
      kind: OperationalEventKind.ORDER_CREATED,
      category: "operational",
      severity: "info",
      title: "Order created",
      detail: `Recorded status · ${input.orderStatus}`,
      occurredAt: createdIso,
      sortKey: 10,
      actor: { role: "system", displayLabel: "Oasis Central" },
      entities: orderEntity(orderId),
      source: SOURCE,
    });
  }

  const finIso = normalizeOperationalTimestamp(input.financeVerifiedAt);
  if (finIso) {
    out.push({
      id: `oe:${orderId}:payment.finance_verified`,
      kind: OperationalEventKind.PAYMENT_FINANCE_VERIFIED,
      category: "financial",
      severity: "info",
      title: "Finance verification recorded",
      detail: input.paymentStatus ? `Payment status · ${input.paymentStatus}` : undefined,
      occurredAt: finIso,
      sortKey: 20,
      actor: { role: "finance", displayLabel: "Finance" },
      entities: orderEntity(orderId),
      source: SOURCE,
    });
  }

  const fin = input.finance;
  const finParts: string[] = [];
  if (fin.awaiting_advance) finParts.push("Awaiting advance");
  if (fin.advance_verified) finParts.push("Advance satisfied");
  if (fin.balance_pending) finParts.push("Balance pending");
  const finSeverity: OperationalEventRecord["severity"] = fin.awaiting_advance ? "warning" : "info";

  out.push({
    id: `oe:${orderId}:payment.advance_state`,
    kind: OperationalEventKind.PAYMENT_ADVANCE_STATE,
    category: "financial",
    severity: finSeverity,
    title: "Finance snapshot",
    detail: finParts.length > 0 ? finParts.join(" · ") : "No advance/balance flags on this snapshot",
    occurredAt: null,
    sortKey: 100,
    actor: { role: "system", displayLabel: "Derived snapshot" },
    entities: orderEntity(orderId),
    source: SOURCE,
  });

  out.push({
    id: `oe:${orderId}:dispatch.visibility`,
    kind: OperationalEventKind.DISPATCH_VISIBILITY,
    category: "dispatch",
    severity: input.dispatchBucket === "not_ready" && input.totalOrdered > 0 ? "warning" : "info",
    title: "Dispatch lane",
    detail: `Bucket · ${input.dispatchBucket.replace(/_/g, " ")}`,
    occurredAt: null,
    sortKey: 110,
    actor: { role: "dispatch", displayLabel: "Dispatch" },
    entities: orderEntity(orderId),
    source: SOURCE,
  });

  const pend = input.pendingReq;
  if (pend.pendingUnits > 0 || pend.pendingLines > 0) {
    out.push({
      id: `oe:${orderId}:store.requisition_pending`,
      kind: OperationalEventKind.STORE_REQUISITION_PENDING,
      category: "operational",
      severity: "warning",
      title: "Store requisitions pending",
      detail: `${pend.pendingLines} open line(s) · ${pend.pendingUnits} unit(s) · ${input.requisitionCount} requisition record(s)`,
      occurredAt: null,
      sortKey: 120,
      actor: { role: "store", displayLabel: "Store" },
      entities: orderEntity(orderId),
      source: SOURCE,
    });
  }

  const terminal = new Set(["completed", "cancelled"]);
  const openJobs = input.jobs.filter((j) => !terminal.has((j.status || "").toLowerCase()));
  if (openJobs.length > 0) {
    const lines = openJobs.slice(0, 5).map((j) => `${j.department.replace(/_/g, " ")} · ${j.status}`);
    if (openJobs.length > 5) lines.push(`+${openJobs.length - 5} more`);
    out.push({
      id: `oe:${orderId}:production.jobs_open`,
      kind: OperationalEventKind.PRODUCTION_JOBS_OPEN,
      category: "operational",
      severity: "info",
      title: "Production jobs in flight",
      detail: lines.join("\n"),
      occurredAt: null,
      sortKey: 130,
      actor: { role: "production", displayLabel: "Production" },
      entities: orderEntity(orderId),
      source: SOURCE,
    });
  }

  if (input.totalOrdered > 0) {
    out.push({
      id: `oe:${orderId}:dispatch.packing_progress`,
      kind: OperationalEventKind.PACKING_PROGRESS,
      category: "dispatch",
      severity: "info",
      title: "Packing progress",
      detail: `Packed ${input.totalPacked} / ${input.totalOrdered} units`,
      occurredAt: null,
      sortKey: 140,
      actor: { role: "dispatch", displayLabel: "Packing" },
      entities: orderEntity(orderId),
      source: SOURCE,
    });
  }

  const current = input.timelineSteps.find((s) => s.state === "current");
  const doneCount = input.timelineSteps.filter((s) => s.state === "done").length;
  const totalSteps = input.timelineSteps.length;
  out.push({
    id: `oe:${orderId}:order.lifecycle_hint`,
    kind: OperationalEventKind.ORDER_LIFECYCLE_HINT,
    category: "operational",
    severity: "info",
    title: "Lifecycle hint",
    detail: current
      ? `Current · ${current.label} (${doneCount}/${totalSteps} prior stages marked complete in this model)`
      : `Progress · ${doneCount}/${totalSteps} stages marked complete`,
    occurredAt: null,
    sortKey: 150,
    actor: { role: "system", displayLabel: "Trace model" },
    entities: orderEntity(orderId),
    source: SOURCE,
  });

  return out;
}
