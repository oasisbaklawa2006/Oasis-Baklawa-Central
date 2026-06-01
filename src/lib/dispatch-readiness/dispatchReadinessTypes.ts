/**
 * Governed dispatch readiness + gate eligibility — eligibility only, not dispatch completion.
 */

export const DISPATCH_READINESS_DIMENSIONS = [
  "queue_ready",
  "packing_evidence_ready",
  "barcode_verified",
  "reservation_ready",
  "finance_signal_ready",
  "gate_scan_ready",
  "document_placeholder_ready",
  "exception_clear",
] as const;

export type DispatchReadinessDimension = (typeof DISPATCH_READINESS_DIMENSIONS)[number];

export const DISPATCH_READINESS_STATUSES = [
  "not_ready",
  "partially_ready",
  "ready_for_review",
  "gate_eligible",
  "exception_blocked",
] as const;

export type DispatchReadinessStatus = (typeof DISPATCH_READINESS_STATUSES)[number];

/** gate_eligible is NOT dispatched — final release is out of scope for Phase 4B. */
export type GateEligibility = "not_eligible" | "eligible_pending_review" | "blocked";

export const DISPATCH_EVIDENCE_TYPES = [
  "packing_photo",
  "carton_barcode",
  "gate_scan",
  "reservation_check",
  "finance_signal",
  "document_placeholder",
  "manual_readiness_review",
] as const;

export type DispatchEvidenceType = (typeof DISPATCH_EVIDENCE_TYPES)[number];

export const DISPATCH_EVIDENCE_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "missing",
  "expired",
] as const;

export type DispatchEvidenceStatus = (typeof DISPATCH_EVIDENCE_STATUSES)[number];

export const DISPATCH_EXCEPTION_TYPES = [
  "dispatch_missing_packing_evidence",
  "dispatch_barcode_mismatch",
  "dispatch_gate_rejected",
  "dispatch_reservation_not_ready",
  "dispatch_finance_signal_blocked",
  "dispatch_document_placeholder_missing",
] as const;

export type DispatchExceptionType = (typeof DISPATCH_EXCEPTION_TYPES)[number];

export type ReservationReadinessStatus =
  | "none"
  | "pending"
  | "partially_reserved"
  | "reserved"
  | "fulfilled"
  | "blocked"
  | "released"
  | "expired"
  | "cancelled";

export interface DispatchQueueSnapshot {
  queueItemId: string | null;
  /** Active dispatch queue item exists and is in an acceptable state for readiness review. */
  isActive: boolean;
  isCompleted: boolean;
  /** Stale optimistic version on queue item blocks readiness progression. */
  hasVersionConflict: boolean;
}

export interface DispatchScanSnapshot {
  hasUnresolvedMismatch: boolean;
  hasRejectedGateScan: boolean;
  gateScanVerified: boolean;
  cartonBarcodeVerified: boolean;
}

/**
 * `pre_dispatch` — golden-chain wizard before dispatch finalize: reservation dimension
 * is not evaluated (reservation is created after dispatch finalization).
 */
export type DispatchReadinessPolicy = "full" | "pre_dispatch";

export interface DispatchReadinessInput {
  orderId: string;
  queue: DispatchQueueSnapshot;
  scan: DispatchScanSnapshot;
  reservationStatus: ReservationReadinessStatus;
  /** Read-only finance signal — never mutates finance tables. */
  financeSignal: import("./financeDispatchSignal").FinanceDispatchSignal;
  packingEvidenceVerified: boolean;
  documentPlaceholderPresent: boolean;
  openExceptionTypes: DispatchExceptionType[];
  readinessPolicy?: DispatchReadinessPolicy;
}

export interface DispatchReadinessProjection {
  orderId: string;
  readinessStatus: DispatchReadinessStatus;
  gateEligibility: GateEligibility;
  dimensionResults: Record<DispatchReadinessDimension, boolean>;
  missingRequirements: string[];
  blockingReasons: string[];
  warnings: string[];
  safeStaffRecommendation: string;
  openExceptions: DispatchExceptionType[];
  evaluatedAt: string;
}

export interface DispatchEvidenceRecord {
  id: string;
  orderId: string;
  queueItemId: string | null;
  evidenceType: DispatchEvidenceType;
  evidenceStatus: DispatchEvidenceStatus;
  evidenceRef: string | null;
  photoRef: string | null;
  documentRef: string | null;
  barcodeRef: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DispatchReadinessWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  overrideReason?: string | null;
}

export type DispatchOperationalEventType =
  | "dispatch_readiness_reviewed"
  | "dispatch_gate_eligible"
  | "dispatch_exception_created"
  | "dispatch_exception_cleared"
  | "dispatch_evidence_added"
  | "dispatch_evidence_rejected"
  | "dispatch_finance_signal_observed";

export interface DispatchOperationalEventRecord {
  id: string;
  eventType: DispatchOperationalEventType;
  orderId: string;
  entityType: "order" | "dispatch_readiness";
  entityId: string;
  title: string;
  message: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  visibility: "internal";
  occurredAt: string;
}

export class DispatchReadinessError extends Error {
  constructor(
    public readonly code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "DispatchReadinessError";
  }
}

/** Actions that must never be implemented in Phase 4B. */
export const FORBIDDEN_DISPATCH_ACTIONS = [
  "dispatch:complete",
  "dispatch:mark_dispatched",
  "dispatch:final_release",
] as const;
