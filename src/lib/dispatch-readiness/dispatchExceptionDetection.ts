import type { DimensionRuleResult } from "./dispatchReadinessRules";
import type {
  DispatchExceptionType,
  DispatchReadinessInput,
} from "./dispatchReadinessTypes";
import type { WorkQueueItem } from "@/lib/work-queues/queueTypes";
import { blockedReadiness } from "@/lib/entity-graph/entityReadiness";

export function detectDispatchExceptionsFromRules(
  input: DispatchReadinessInput,
  results: DimensionRuleResult[],
): DispatchExceptionType[] {
  const detected = new Set<DispatchExceptionType>(input.openExceptionTypes);

  for (const r of results) {
    if (r.satisfied) continue;
    if (r.dimension === "packing_evidence_ready") {
      detected.add("dispatch_missing_packing_evidence");
    }
    if (r.dimension === "barcode_verified" && input.scan.hasUnresolvedMismatch) {
      detected.add("dispatch_barcode_mismatch");
    }
    if (r.dimension === "gate_scan_ready" && input.scan.hasRejectedGateScan) {
      detected.add("dispatch_gate_rejected");
    }
    if (r.dimension === "reservation_ready") {
      detected.add("dispatch_reservation_not_ready");
    }
    if (r.dimension === "finance_signal_ready") {
      detected.add("dispatch_finance_signal_blocked");
    }
    if (r.dimension === "document_placeholder_ready") {
      detected.add("dispatch_document_placeholder_missing");
    }
  }

  return [...detected];
}

export function buildDispatchExceptionQueueItem(
  orderId: string,
  exceptionType: DispatchExceptionType,
  title: string,
): WorkQueueItem {
  return {
    id: `dispatch-ex:${orderId}:${exceptionType}`,
    queueId: "dispatch_queue",
    entityRefs: [{ type: "order", id: orderId }],
    priority: "urgent",
    priorityScore: 80,
    readiness: blockedReadiness([{ code: exceptionType, label: title }]),
    blockers: [{ code: exceptionType, label: title, isRoot: true }],
    ownerRole: "dispatch_manager",
    escalationTier: "department_head",
    escalationSeverity: "high",
    dependency: { state: "blocked", waitingOn: exceptionType },
    customerImpact: false,
    operationalSeverity: "high",
    title,
    summary: `Dispatch exception — ${exceptionType}`,
  };
}

export const DISPATCH_EXCEPTION_LABELS: Record<DispatchExceptionType, string> = {
  dispatch_missing_packing_evidence: "Missing packing evidence",
  dispatch_barcode_mismatch: "Barcode mismatch",
  dispatch_gate_rejected: "Gate scan rejected",
  dispatch_reservation_not_ready: "Reservation not ready",
  dispatch_finance_signal_blocked: "Finance signal blocked",
  dispatch_document_placeholder_missing: "Document placeholder missing",
};
