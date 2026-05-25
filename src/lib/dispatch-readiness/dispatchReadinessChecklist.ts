import type { DimensionRuleResult } from "./dispatchReadinessRules";
import type { DispatchReadinessProjection } from "./dispatchReadinessTypes";

export function buildMissingRequirements(results: DimensionRuleResult[]): string[] {
  return results
    .filter((r) => !r.satisfied && r.missingLabel)
    .map((r) => r.missingLabel as string);
}

export function buildWarnings(results: DimensionRuleResult[]): string[] {
  return results.filter((r) => r.warning).map((r) => r.warning as string);
}

export function buildBlockingReasons(
  missing: string[],
  openExceptions: string[],
): string[] {
  const blocks = [...missing];
  for (const ex of openExceptions) {
    blocks.push(`Open exception: ${ex}`);
  }
  return blocks;
}

export function buildSafeStaffRecommendation(
  status: DispatchReadinessProjection["readinessStatus"],
  gateEligibility: DispatchReadinessProjection["gateEligibility"],
): string {
  if (status === "exception_blocked") {
    return "Resolve dispatch exceptions before gate review. Do not mark dispatched.";
  }
  if (status === "gate_eligible") {
    return "Gate eligibility confirmed — ready for supervised review only. Not dispatched.";
  }
  if (status === "ready_for_review") {
    return "All checklist dimensions satisfied — supervisor may record readiness review event.";
  }
  if (status === "partially_ready") {
    return "Complete missing evidence and scans before gate review.";
  }
  if (gateEligibility === "blocked") {
    return "Gate blocked — address blocking reasons. No final release in this phase.";
  }
  return "Dispatch not ready — gather evidence and clear blockers.";
}
