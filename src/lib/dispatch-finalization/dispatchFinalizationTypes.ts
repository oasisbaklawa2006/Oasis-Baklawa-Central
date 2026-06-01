/**
 * Phase 4E — Governed dispatch finalization (first auditable orders.status → dispatched path).
 */

import type { DispatchCompletionStatus } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";

export const DISPATCH_RELEASE_STATUSES = [
  "dispatch_release_pending",
  "dispatch_release_ready",
  "dispatch_release_blocked",
  "dispatch_finalized",
  "dispatch_reversal_pending",
  "dispatch_reversed",
] as const;

export type DispatchReleaseStatus = (typeof DISPATCH_RELEASE_STATUSES)[number];

export const DISPATCH_RELEASE_TYPES = [
  "finalize",
  "reversal",
  "stock_confirmation",
  "stock_reversal",
  "customer_publication",
  "transport_handoff",
  "override",
] as const;

export type DispatchReleaseType = (typeof DISPATCH_RELEASE_TYPES)[number];

export const GOVERNED_DISPATCH_SOURCE_STATUSES = [
  "approved",
  "in_production",
  "manufacturing",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
  "ready_for_dispatch",
] as const;

export type GovernedDispatchSourceStatus = (typeof GOVERNED_DISPATCH_SOURCE_STATUSES)[number];

export const DISPATCH_FINALIZE_TARGET_STATUS = "dispatched" as const;

/**
 * `pre_dispatch_wizard` — Golden Chain: finalize dispatch before inventory reservation.
 */
export type DispatchFinalizationPolicy = "full" | "pre_dispatch_wizard";

export interface DispatchFinalizationInput {
  orderId: string;
  currentOrderStatus: string;
  readinessStatus: DispatchReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeReleaseStatus: FinanceReleaseStatus;
  completionStatus: DispatchCompletionStatus;
  reservationReady: boolean;
  transporterHandoffFinalized: boolean;
  gateReference: string | null;
  completionReference: string | null;
  transporterReference: string | null;
  openReleaseBlockers: string[];
  finalizationPolicy?: DispatchFinalizationPolicy;
}

export interface DispatchReleaseProjection {
  orderId: string;
  releaseStatus: DispatchReleaseStatus;
  blockingReasons: string[];
  warnings: string[];
  releaseRecommendation: string;
  canFinalize: boolean;
  canPublishCustomerRelease: boolean;
  evaluatedAt: string;
}

export interface DispatchReleaseLineageRecord {
  id: string;
  orderId: string;
  previousStatus: string;
  nextStatus: string;
  releaseReason: string | null;
  releaseType: DispatchReleaseType;
  transporterReference: string | null;
  gateReference: string | null;
  completionReference: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  overrideReason: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DispatchFinalizationWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  overrideReason?: string | null;
  reversalReason?: string | null;
  finalizeReason?: string | null;
}

export type DispatchFinalizationOperationalEventType =
  | "dispatch_release_ready"
  | "dispatch_release_blocked"
  | "dispatch_finalized"
  | "dispatch_customer_release_published"
  | "dispatch_reversal_requested"
  | "dispatch_reversal_completed"
  | "dispatch_stock_consumption_confirmed"
  | "dispatch_stock_consumption_reversed"
  | "dispatch_transport_handoff_finalized";

export interface DispatchFinalizationOperationalEventRecord {
  id: string;
  eventType: DispatchFinalizationOperationalEventType;
  orderId: string;
  title: string;
  message: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  visibility: "internal" | "customer_safe";
  occurredAt: string;
}

export interface OrderDispatchStatusUpdateParams {
  orderId: string;
  expectedPreviousStatus: string;
  nextStatus: typeof DISPATCH_FINALIZE_TARGET_STATUS;
  trackingNumber?: string | null;
  courierName?: string | null;
}

export interface OrderDispatchStatusUpdateResult {
  updated: boolean;
  previousStatus: string;
  nextStatus: string;
}

export interface OrderDispatchStatusRepository {
  getOrderStatus(orderId: string): Promise<{ status: string } | null>;
  updateOrderDispatchStatus(params: OrderDispatchStatusUpdateParams): Promise<OrderDispatchStatusUpdateResult>;
  insertStatusHistory(params: {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    actorId?: string | null;
  }): Promise<void>;
}

export interface DispatchLineageStore {
  insertLineage(row: Omit<DispatchReleaseLineageRecord, "id" | "createdAt">): Promise<DispatchReleaseLineageRecord>;
  listByOrder(orderId: string): Promise<DispatchReleaseLineageRecord[]>;
}

export class DispatchFinalizationError extends Error {
  constructor(
    public readonly code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "not_eligible"
      | "reason_required"
      | "stale_status"
      | "already_finalized",
    message: string,
  ) {
    super(message);
    this.name = "DispatchFinalizationError";
  }
}

export const FORBIDDEN_FINALIZATION_UI_PATTERNS = [
  "capturePayment",
  "generateInvoice",
  "eway",
  "razorpay",
  "stripe",
  "sendNotification",
  "deductStock",
  "autoFinalize",
  "forceDispatch",
] as const;
