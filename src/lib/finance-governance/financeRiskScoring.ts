import type { CommercialRiskLevel, FinanceGovernanceInput } from "./financeGovernanceTypes";

export interface RiskScoreInput {
  orderValue: number;
  outstandingExposure: number;
  complaintSeverity: FinanceGovernanceInput["complaintSeverity"];
  reservationReady: boolean;
  dispatchGateEligible: boolean;
  manualOverrideCount: number;
  rejectionCount: number;
  escalationCount: number;
  openHoldCount: number;
}

const LARGE_VALUE_THRESHOLD = 500_000;

export function scoreCommercialRisk(input: RiskScoreInput): CommercialRiskLevel {
  let score = 0;

  if (input.orderValue >= LARGE_VALUE_THRESHOLD) score += 2;
  if (input.outstandingExposure > 0) score += 1;
  if (input.complaintSeverity === "high") score += 3;
  else if (input.complaintSeverity === "medium") score += 2;
  else if (input.complaintSeverity === "low") score += 1;

  if (!input.reservationReady) score += 1;
  if (!input.dispatchGateEligible) score += 1;
  if (input.openHoldCount > 0) score += 2;
  if (input.manualOverrideCount >= 2) score += 2;
  if (input.rejectionCount >= 2) score += 2;
  if (input.escalationCount >= 3) score += 2;

  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}
