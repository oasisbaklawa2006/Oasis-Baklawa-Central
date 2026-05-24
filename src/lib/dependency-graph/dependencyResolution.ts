import {
  customerImpactFromBlockers,
  downstreamImpact,
  findLaneBlockers,
  rootBlocker,
  severityFromBlockers,
  type DependencyBlocker,
} from "./dependencyBlockers";
import type { LaneSatisfactionMap, OperationalDependencyNode } from "./dependencyTypes";
import { DEFAULT_OPERATIONAL_DEPENDENCY_GRAPH } from "./dependencyTypes";
import type { OperationalSeverity } from "@/lib/entity-graph/entityEscalation";

export interface DependencyResolutionResult {
  blockers: DependencyBlocker[];
  rootBlocker: DependencyBlocker | null;
  downstreamImpact: string[];
  customerImpact: boolean;
  escalationRecommendation: string;
  operationalSeverity: OperationalSeverity;
}

export function resolveOperationalDependencies(
  satisfaction: LaneSatisfactionMap,
  graph: OperationalDependencyNode[] = DEFAULT_OPERATIONAL_DEPENDENCY_GRAPH,
): DependencyResolutionResult {
  const blockers = findLaneBlockers(graph, satisfaction);
  const root = rootBlocker(blockers);
  const downstream = downstreamImpact(blockers, root);
  const customerImpact = customerImpactFromBlockers(blockers);
  const operationalSeverity = severityFromBlockers(blockers);

  let escalationRecommendation = "No blockers — routine monitoring.";
  if (root) {
    escalationRecommendation = customerImpact
      ? `Root blocker: ${root.label}. Escalate to lane owner with customer-impact context. No auto-escalation.`
      : `Root blocker: ${root.label}. Internal follow-up only.`;
  }

  return {
    blockers,
    rootBlocker: root,
    downstreamImpact: downstream,
    customerImpact,
    escalationRecommendation,
    operationalSeverity,
  };
}
