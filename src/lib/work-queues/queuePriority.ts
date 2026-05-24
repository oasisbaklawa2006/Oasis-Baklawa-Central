import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";
import { priorityScore } from "@/lib/entity-graph/entityPriority";
import type { OperationalSeverity } from "@/lib/entity-graph/entityEscalation";
import type { WorkQueueItem } from "./queueTypes";

export interface QueuePriorityInput {
  priority: EntityPriorityBand;
  operationalSeverity: OperationalSeverity;
  customerImpact: boolean;
  agingHours?: number;
  blockerCount: number;
}

export function computeQueueItemScore(input: QueuePriorityInput): number {
  let score = priorityScore(input.priority);
  if (input.customerImpact) score += 10;
  if (input.operationalSeverity === "critical") score += 25;
  else if (input.operationalSeverity === "high") score += 15;
  else if (input.operationalSeverity === "medium") score += 5;
  if ((input.agingHours ?? 0) >= 24) score += Math.min(20, Math.floor((input.agingHours ?? 0) / 24) * 5);
  score += Math.min(15, input.blockerCount * 3);
  return score;
}

export function sortQueueItems(items: WorkQueueItem[]): WorkQueueItem[] {
  return [...items].sort((a, b) => b.priorityScore - a.priorityScore);
}
