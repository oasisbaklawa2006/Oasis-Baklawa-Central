import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { detectFinanceHolds, holdBlocksCommercialRelease } from "./financeHoldRules";
import { scoreCommercialRisk } from "./financeRiskScoring";
import type {
  FinanceGovernanceInput,
  FinanceReleaseProjection,
  FinanceReleaseStatus,
} from "./financeGovernanceTypes";

export function deriveDispatchFinanceSignal(
  releaseStatus: FinanceReleaseStatus,
  holds: string[],
  staleReview: boolean,
): FinanceDispatchSignal {
  if (holds.length > 0 || releaseStatus === "commercially_blocked" || releaseStatus === "finance_hold") {
    return "blocked";
  }
  if (releaseStatus === "commercially_released" || releaseStatus === "finance_conditionally_ready") {
    return "ready";
  }
  if (staleReview || releaseStatus === "pending_finance_review" || releaseStatus.includes("review")) {
    return "pending_review";
  }
  return "unknown";
}

export function deriveReleaseStatus(
  input: FinanceGovernanceInput,
  holds: ReturnType<typeof detectFinanceHolds>,
  risk: ReturnType<typeof scoreCommercialRisk>,
): FinanceReleaseStatus {
  if (risk === "critical") return "commercially_blocked";

  if (holdBlocksCommercialRelease(holds)) {
    if (holds.includes("advance_unverified") || holds.includes("advance_missing")) {
      return input.advanceRequired > 0 ? "advance_under_review" : "finance_hold";
    }
    if (holds.includes("credit_limit_exceeded")) return "credit_under_review";
    return "finance_hold";
  }

  if (!input.reservationReady || !input.dispatchReadinessGateEligible) {
    return "finance_conditionally_ready";
  }

  if (input.advanceRequired > 0 && !input.advanceVerified) return "advance_under_review";
  if (!input.creditApproved && input.orderValue > 250_000) return "credit_under_review";
  if (input.staleFinanceReview) return "pending_finance_review";

  return "commercially_released";
}

export function projectFinanceRelease(input: FinanceGovernanceInput): FinanceReleaseProjection {
  const holds = detectFinanceHolds(input);
  const risk = scoreCommercialRisk({
    orderValue: input.orderValue,
    outstandingExposure: Math.max(0, input.advanceRequired - (input.advanceVerified ? input.advanceRequired : 0)),
    complaintSeverity: input.complaintSeverity,
    reservationReady: input.reservationReady,
    dispatchGateEligible: input.dispatchReadinessGateEligible,
    manualOverrideCount: input.manualOverrideCount,
    rejectionCount: input.rejectionCount,
    escalationCount: input.escalationCount,
    openHoldCount: holds.length,
  });

  const releaseStatus = deriveReleaseStatus(input, holds, risk);
  const blockingReasons: string[] = holds.map((h) => `Hold: ${h}`);
  if (!input.reservationReady) blockingReasons.push("Reservation not ready for commercial release");
  if (!input.dispatchReadinessGateEligible) {
    blockingReasons.push("Dispatch gate not eligible — commercial release does not imply dispatch");
  }
  if (releaseStatus === "commercially_blocked") {
    blockingReasons.push("Commercial release blocked by risk policy");
  }

  const warnings: string[] = [];
  if (releaseStatus === "commercially_released") {
    warnings.push("Commercially released ≠ dispatched ≠ invoiced");
  }
  if (risk === "high" || risk === "critical") {
    warnings.push(`Elevated commercial risk: ${risk}`);
  }

  const dispatchFinanceSignal = deriveDispatchFinanceSignal(releaseStatus, holds, input.staleFinanceReview);

  let releaseRecommendation = "Pending finance review";
  if (releaseStatus === "commercially_released") {
    releaseRecommendation = "Commercially releasable for operational progression — not dispatched";
  } else if (releaseStatus === "finance_conditionally_ready") {
    releaseRecommendation = "Conditional readiness — resolve upstream dispatch/reservation gates";
  } else if (blockingReasons.length > 0) {
    releaseRecommendation = "Blocked — resolve finance holds and evidence";
  }

  return {
    orderId: input.orderId,
    releaseStatus,
    blockingReasons,
    warnings,
    commercialRiskLevel: risk,
    releaseRecommendation,
    dispatchFinanceSignal,
    evaluatedAt: new Date().toISOString(),
  };
}
