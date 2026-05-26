import type { ExecutionIntelligenceInput, ExecutionRiskAssessment } from "./executionIntelligenceTypes";
import { rankExecutionRisks } from "./executionRiskScoring";

/**
 * Internal customer-risk lane — weights orders with customerId and high SLA/risk.
 * Does not expose internal labels to customers (projection for staff CMD only).
 */
export function projectCustomerRiskLane(input: ExecutionIntelligenceInput): ExecutionRiskAssessment[] {
  const risks = rankExecutionRisks(input);
  return risks
    .filter((r) => {
      const item = input.queueItems.find((q) => q.entityId === r.entityId && q.orderId);
      return Boolean(item?.customerId || item?.orderId);
    })
    .filter((r) => r.level === "high" || r.level === "critical" || r.level === "medium")
    .slice(0, 25);
}
