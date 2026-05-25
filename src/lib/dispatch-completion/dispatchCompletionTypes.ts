/**
 * Phase 4D — Controlled dispatch completion governance (attestation only).
 * Does NOT mutate orders.status, deduct stock, invoice, or capture payment.
 */

import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";

export const DISPATCH_COMPLETION_STATUSES = [
  "not_eligible",
  "prerequisites_pending",
  "completion_eligible",
  "completion_attested",
  "completion_blocked",
  "already_dispatched",
] as const;

export type DispatchCompletionStatus = (typeof DISPATCH_COMPLETION_STATUSES)[number];

export const DISPATCH_COMPLETION_EVIDENCE_TYPES = [
  "completion_review",
  "completion_attestation",
  "completion_hold",
  "completion_hold_release",
  "supervisor_override",
] as const;

export type DispatchCompletionEvidenceType = (typeof DISPATCH_COMPLETION_EVIDENCE_TYPES)[number];

export const DISPATCH_COMPLETION_EVIDENCE_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "blocked",
  "released",
] as const;

export type DispatchCompletionEvidenceStatus = (typeof DISPATCH_COMPLETION_EVIDENCE_STATUSES)[number];

export const DISPATCH_COMPLETION_HOLD_TYPES = [
  "security_gate_pending",
  "courier_manifest_missing",
  "supervisor_review_required",
  "finance_signal_stale",
  "readiness_regression",
] as const;

export type DispatchCompletionHoldType = (typeof DISPATCH_COMPLETION_HOLD_TYPES)[number];

export interface DispatchCompletionInput {
  orderId: string;
  queueItemId: string | null;
  readinessStatus: DispatchReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeReleaseStatus: FinanceReleaseStatus;
  reservationReady: boolean;
  orderAlreadyDispatched: boolean;
  securityGatePassed: boolean;
  courierManifestAttached: boolean;
  openCompletionHolds: DispatchCompletionHoldType[];
}

export interface DispatchCompletionProjection {
  orderId: string;
  completionStatus: DispatchCompletionStatus;
  blockingReasons: string[];
  warnings: string[];
  completionRecommendation: string;
  readinessStatus: DispatchReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeReleaseStatus: FinanceReleaseStatus;
  evaluatedAt: string;
}

export interface DispatchCompletionEvidenceRecord {
  id: string;
  orderId: string;
  queueItemId: string | null;
  evidenceType: DispatchCompletionEvidenceType;
  evidenceStatus: DispatchCompletionEvidenceStatus;
  completionStatus: DispatchCompletionStatus;
  evidenceRef: string | null;
  courierRef: string | null;
  manifestRef: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  overrideReason: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DispatchCompletionWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  overrideReason?: string | null;
  attestationReason?: string | null;
}

export type DispatchCompletionOperationalEventType =
  | "dispatch_completion_reviewed"
  | "dispatch_completion_attested"
  | "dispatch_completion_hold_placed"
  | "dispatch_completion_hold_released";

export interface DispatchCompletionOperationalEventRecord {
  id: string;
  eventType: DispatchCompletionOperationalEventType;
  orderId: string;
  title: string;
  message: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  visibility: "internal";
  occurredAt: string;
}

export const FORBIDDEN_COMPLETION_ACTIONS = [
  "dispatch:mark_dispatched",
  "dispatch:mutate_order_status",
  "dispatch:deduct_stock",
  "dispatch:generate_invoice",
] as const;

export class DispatchCompletionError extends Error {
  constructor(
    public readonly code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "not_eligible"
      | "reason_required",
    message: string,
  ) {
    super(message);
    this.name = "DispatchCompletionError";
  }
}
