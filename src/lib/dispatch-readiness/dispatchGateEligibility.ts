import type { DimensionRuleResult } from "./dispatchReadinessRules";
import type {
  DispatchReadinessStatus,
  GateEligibility,
} from "./dispatchReadinessTypes";

export function deriveReadinessStatus(
  results: DimensionRuleResult[],
  hasOpenExceptions: boolean,
): DispatchReadinessStatus {
  if (hasOpenExceptions) return "exception_blocked";

  const satisfiedCount = results.filter((r) => r.satisfied).length;
  const total = results.length;

  if (satisfiedCount === 0) return "not_ready";
  if (satisfiedCount < total) return "partially_ready";

  const allSatisfied = results.every((r) => r.satisfied);
  if (!allSatisfied) return "partially_ready";

  return "ready_for_review";
}

export function deriveGateEligibility(
  readinessStatus: DispatchReadinessStatus,
  results: DimensionRuleResult[],
  hasOpenExceptions: boolean,
): GateEligibility {
  if (hasOpenExceptions || readinessStatus === "exception_blocked") {
    return "blocked";
  }

  const allSatisfied = results.every((r) => r.satisfied);
  if (!allSatisfied) return "not_eligible";

  if (readinessStatus === "ready_for_review" || readinessStatus === "gate_eligible") {
    return "eligible_pending_review";
  }

  return "not_eligible";
}

/** Promote to gate_eligible status when all dimensions pass and no exceptions — still NOT dispatched. */
export function promoteToGateEligibleIfEligible(
  current: DispatchReadinessStatus,
  gateEligibility: GateEligibility,
): DispatchReadinessStatus {
  if (gateEligibility === "eligible_pending_review" && current === "ready_for_review") {
    return "gate_eligible";
  }
  return current;
}
