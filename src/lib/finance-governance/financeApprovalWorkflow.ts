import { requireRejectionReason } from "./financeEvidenceModel";
import type { FinanceGovernanceInput, FinanceGovernanceWriteContext } from "./financeGovernanceTypes";
import { projectFinanceRelease } from "./financeReleaseEligibility";

export function canCommerciallyRelease(input: FinanceGovernanceInput): boolean {
  const projection = projectFinanceRelease(input);
  return projection.releaseStatus === "commercially_released";
}

export function validateCommercialReleaseAttempt(
  input: FinanceGovernanceInput,
  ctx: FinanceGovernanceWriteContext,
): { allowed: boolean; reason: string } {
  const projection = projectFinanceRelease(input);
  if (projection.releaseStatus === "commercially_released") {
    return { allowed: true, reason: "Eligible for commercial release record" };
  }
  return {
    allowed: false,
    reason: projection.blockingReasons.join("; ") || "Not commercially releasable",
  };
}

export function validateRejection(ctx: FinanceGovernanceWriteContext): void {
  requireRejectionReason(ctx.rejectionReason);
}
