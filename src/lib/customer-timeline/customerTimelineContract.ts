import type { CustomerTimelineProjectionResult } from "./customerTimelineTypes";
import type { ComplaintState, CustomerTimelineStatusCode } from "./customerTimelineTypes";

/** Future customer-app binding — no internal operational fields. */
export interface CustomerTimelinePublicStep {
  code: CustomerTimelineStatusCode;
  label: string;
  description: string;
  completed: boolean;
  active: boolean;
}

export interface CustomerTimelinePublicContract {
  orderId: string;
  /** Optional public reference when bound to customer app (not queue/SO internals). */
  publicOrderRef: string | null;
  currentStatus: CustomerTimelineStatusCode;
  publicSteps: CustomerTimelinePublicStep[];
  progressPercent: number;
  safeDetail: string | null;
  lastPublicUpdateAt: string | null;
  supportWindowEndsAt: string | null;
  complaintState: ComplaintState;
}

export function toCustomerTimelinePublicContract(
  projection: CustomerTimelineProjectionResult,
  publicOrderRef?: string | null,
): CustomerTimelinePublicContract {
  return {
    orderId: projection.orderId,
    publicOrderRef: publicOrderRef ?? null,
    currentStatus: projection.currentStatus,
    publicSteps: projection.steps.map((s) => ({
      code: s.code,
      label: s.label,
      description: s.description,
      completed: s.completed,
      active: s.active,
    })),
    progressPercent: projection.progressPercent,
    safeDetail: projection.safeDetail,
    lastPublicUpdateAt: projection.lastPublicUpdateAt,
    supportWindowEndsAt: projection.supportWindowEndsAt,
    complaintState: projection.complaintState,
  };
}

/** Ensures contract shape never leaks forbidden keys. */
export function assertPublicContractSafe(contract: CustomerTimelinePublicContract): void {
  const json = JSON.stringify(contract).toLowerCase();
  const forbidden = [
    "queue_item",
    "operational_event",
    "actor",
    "department",
    "reason_code",
    "escalation",
    "blocker",
    "finance hold",
    "mismatch",
    "correlation",
  ];
  for (const f of forbidden) {
    if (json.includes(f)) {
      throw new Error(`Public contract leaked forbidden key: ${f}`);
    }
  }
}
