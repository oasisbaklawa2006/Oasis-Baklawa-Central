/**
 * Phase 4C — Controlled commercial release governance (not payment capture / invoicing).
 */

export const FINANCE_RELEASE_STATUSES = [
  "pending_finance_review",
  "advance_under_review",
  "credit_under_review",
  "finance_hold",
  "finance_conditionally_ready",
  "commercially_released",
  "commercially_blocked",
] as const;

export type FinanceReleaseStatus = (typeof FINANCE_RELEASE_STATUSES)[number];

export const FINANCE_REVIEW_TYPES = [
  "advance_verification",
  "credit_review",
  "finance_hold",
  "commercial_release",
  "override_review",
] as const;

export type FinanceReviewType = (typeof FINANCE_REVIEW_TYPES)[number];

export const FINANCE_REVIEW_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "blocked",
  "released",
] as const;

export type FinanceReviewStatus = (typeof FINANCE_REVIEW_STATUSES)[number];

export const FINANCE_HOLD_TYPES = [
  "advance_missing",
  "advance_unverified",
  "credit_limit_exceeded",
  "risk_review_required",
  "commercial_dispute",
  "compliance_review_pending",
] as const;

export type FinanceHoldType = (typeof FINANCE_HOLD_TYPES)[number];

export const COMMERCIAL_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export type CommercialRiskLevel = (typeof COMMERCIAL_RISK_LEVELS)[number];

export type FinanceOperationalEventType =
  | "finance_review_started"
  | "finance_advance_verified"
  | "finance_hold_created"
  | "finance_hold_released"
  | "finance_commercially_released"
  | "finance_release_rejected"
  | "finance_override_applied"
  | "finance_risk_escalated";

export interface FinanceGovernanceInput {
  orderId: string;
  orderValue: number;
  advanceRequired: number;
  advanceVerified: boolean;
  creditApproved: boolean;
  openHoldTypes: FinanceHoldType[];
  reservationReady: boolean;
  dispatchReadinessGateEligible: boolean;
  complaintSeverity: "none" | "low" | "medium" | "high";
  staleFinanceReview: boolean;
  manualOverrideCount: number;
  rejectionCount: number;
  escalationCount: number;
}

export interface FinanceReleaseProjection {
  orderId: string;
  releaseStatus: FinanceReleaseStatus;
  blockingReasons: string[];
  warnings: string[];
  commercialRiskLevel: CommercialRiskLevel;
  releaseRecommendation: string;
  dispatchFinanceSignal: import("@/lib/dispatch-readiness/financeDispatchSignal").FinanceDispatchSignal;
  evaluatedAt: string;
}

export interface FinanceEvidenceRecord {
  id: string;
  orderId: string;
  reviewType: FinanceReviewType;
  reviewStatus: FinanceReviewStatus;
  evidenceType: string;
  evidenceRef: string | null;
  utrRef: string | null;
  amount: number | null;
  currency: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  overrideReason: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FinanceGovernanceWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  overrideReason?: string | null;
  rejectionReason?: string | null;
}

export interface FinanceOperationalEventRecord {
  id: string;
  eventType: FinanceOperationalEventType;
  orderId: string;
  title: string;
  message: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  visibility: "internal";
  occurredAt: string;
}

export const FORBIDDEN_FINANCE_ACTIONS = [
  "finance:capture_payment",
  "finance:generate_invoice",
  "finance:dispatch_complete",
  "finance:deduct_stock",
] as const;

export class FinanceGovernanceError extends Error {
  constructor(
    public readonly code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "reason_required",
    message: string,
  ) {
    super(message);
    this.name = "FinanceGovernanceError";
  }
}
