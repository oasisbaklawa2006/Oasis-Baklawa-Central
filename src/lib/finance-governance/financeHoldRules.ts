import type { FinanceGovernanceInput, FinanceHoldType } from "./financeGovernanceTypes";

export function detectFinanceHolds(input: FinanceGovernanceInput): FinanceHoldType[] {
  const holds = new Set<FinanceHoldType>(input.openHoldTypes);

  if (input.advanceRequired > 0 && !input.advanceVerified) {
    holds.add(input.advanceRequired > 0 && input.orderValue > 0 ? "advance_unverified" : "advance_missing");
  }
  if (!input.creditApproved && input.orderValue > 250_000) {
    holds.add("credit_limit_exceeded");
  }
  if (input.complaintSeverity === "high" || input.complaintSeverity === "medium") {
    holds.add("commercial_dispute");
  }
  if (input.staleFinanceReview) {
    holds.add("compliance_review_pending");
  }
  if (input.manualOverrideCount >= 2 || input.rejectionCount >= 2) {
    holds.add("risk_review_required");
  }

  return [...holds];
}

export function holdBlocksCommercialRelease(holds: FinanceHoldType[]): boolean {
  return holds.length > 0;
}

export const FINANCE_HOLD_LABELS: Record<FinanceHoldType, string> = {
  advance_missing: "Advance missing",
  advance_unverified: "Advance unverified",
  credit_limit_exceeded: "Credit limit review required",
  risk_review_required: "Risk review required",
  commercial_dispute: "Commercial dispute",
  compliance_review_pending: "Compliance review pending",
};
