import type { DependencyResolutionResult } from "./dependencyResolution";
import type { EscalationTier } from "@/lib/entity-graph/entityEscalation";

export interface DependencyEscalationProjection {
  tier: EscalationTier;
  topic: string;
  recommendation: string;
}

export function projectDependencyEscalation(result: DependencyResolutionResult): DependencyEscalationProjection {
  if (!result.rootBlocker) {
    return { tier: "none", topic: "clear", recommendation: result.escalationRecommendation };
  }
  const { operationalSeverity, customerImpact } = result;
  let tier: EscalationTier = "team_lead";
  if (operationalSeverity === "critical" || customerImpact) tier = "cmd";
  else if (operationalSeverity === "high") tier = "department_head";

  return {
    tier,
    topic: result.rootBlocker.lane,
    recommendation: result.escalationRecommendation,
  };
}
