import type { OperationalDependencyLane, OperationalDependencyNode, LaneSatisfactionMap } from "./dependencyTypes";
import type { OperationalSeverity } from "@/lib/entity-graph/entityEscalation";

export interface DependencyBlocker {
  lane: OperationalDependencyLane;
  label: string;
  blockedBy: OperationalDependencyLane[];
  isRoot: boolean;
}

export function findLaneBlockers(
  graph: OperationalDependencyNode[],
  satisfaction: LaneSatisfactionMap,
): DependencyBlocker[] {
  const blockers: DependencyBlocker[] = [];
  for (const node of graph) {
    const blockedBy = node.dependsOn.filter((d) => satisfaction[d] !== true);
    const selfOk = satisfaction[node.lane] === true;
    if (!selfOk || blockedBy.length > 0) {
      const isRoot = blockedBy.length === 0 && satisfaction[node.lane] !== true;
      blockers.push({
        lane: node.lane,
        label: node.label,
        blockedBy,
        isRoot,
      });
    }
  }
  return blockers;
}

export function rootBlocker(blockers: DependencyBlocker[]): DependencyBlocker | null {
  const roots = blockers.filter((b) => b.isRoot);
  if (roots.length > 0) return roots[0];
  const withUpstream = blockers.filter((b) => b.blockedBy.length > 0);
  if (withUpstream.length === 0) return blockers[0] ?? null;
  const shallowest = [...withUpstream].sort((a, b) => a.blockedBy.length - b.blockedBy.length)[0];
  return shallowest;
}

export function downstreamImpact(blockers: DependencyBlocker[], root: DependencyBlocker | null): string[] {
  if (!root) return [];
  return blockers
    .filter((b) => b.lane !== root.lane && (b.blockedBy.includes(root.lane) || b.blockedBy.some((d) => root.blockedBy.includes(d) || d === root.lane)))
    .map((b) => `${b.label} blocked`);
}

export function customerImpactFromBlockers(blockers: DependencyBlocker[]): boolean {
  const customerLanes: OperationalDependencyLane[] = ["finance", "dispatch", "shipment", "reservation"];
  return blockers.some((b) => customerLanes.includes(b.lane));
}

export function severityFromBlockers(blockers: DependencyBlocker[]): OperationalSeverity {
  if (blockers.some((b) => b.lane === "dispatch" || b.lane === "shipment")) return "critical";
  if (blockers.some((b) => b.lane === "finance" || b.lane === "reservation")) return "high";
  if (blockers.length > 2) return "medium";
  return blockers.length > 0 ? "low" : "low";
}
