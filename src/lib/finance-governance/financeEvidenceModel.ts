import type { FinanceEvidenceRecord, FinanceReviewStatus, FinanceReviewType } from "./financeGovernanceTypes";

export function validateFinanceEvidenceInsert(
  row: Pick<
    FinanceEvidenceRecord,
    "orderId" | "reviewType" | "reviewStatus" | "correlationId"
  >,
): void {
  if (!row.orderId?.trim()) throw new Error("finance_review_evidence requires order_id");
  if (!row.correlationId?.trim()) throw new Error("finance_review_evidence requires correlation_id");

  const types: FinanceReviewType[] = [
    "advance_verification",
    "credit_review",
    "finance_hold",
    "commercial_release",
    "override_review",
  ];
  if (!types.includes(row.reviewType)) {
    throw new Error(`Invalid review_type: ${row.reviewType}`);
  }

  const statuses: FinanceReviewStatus[] = ["pending", "verified", "rejected", "blocked", "released"];
  if (!statuses.includes(row.reviewStatus)) {
    throw new Error(`Invalid review_status: ${row.reviewStatus}`);
  }
}

import { FinanceGovernanceError } from "./financeGovernanceTypes";

export function requireRejectionReason(reason: string | null | undefined): void {
  if (!reason?.trim()) {
    throw new FinanceGovernanceError("reason_required", "Rejection requires typed rejectionReason");
  }
}

export function requireOverrideReason(reason: string | null | undefined): void {
  if (!reason?.trim()) {
    throw new Error("Override requires typed overrideReason");
  }
}
