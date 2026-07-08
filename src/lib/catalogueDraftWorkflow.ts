/**
 * Pure workflow rules for catalogue AI-Studio drafts (PR #225).
 * No I/O — status transitions and editability only. Persistence lives in catalogueDraftRepository.ts.
 */
import type { CatalogueDraftStatus } from "@/lib/catalogueDraftTypes";

export const STATUS_LABEL: Record<CatalogueDraftStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Only a DRAFT is directly editable; APPROVED/REJECTED/UNDER_REVIEW are read-only in this UI. */
export function isDraftEditable(status: CatalogueDraftStatus): boolean {
  return status === "DRAFT";
}

export function canSubmitForReview(status: CatalogueDraftStatus): boolean {
  return status === "DRAFT";
}

export function canApprove(status: CatalogueDraftStatus): boolean {
  return status === "UNDER_REVIEW";
}

export function canReject(status: CatalogueDraftStatus): boolean {
  return status === "UNDER_REVIEW";
}
