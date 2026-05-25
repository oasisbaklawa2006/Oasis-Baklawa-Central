import type { ExecutionIntelligenceInput, OwnershipCell } from "./executionIntelligenceTypes";
import { assessQueueSla } from "./slaBreachDetection";

const OVERLOAD_THRESHOLD = 8;

export function projectQueueOwnershipMatrix(input: ExecutionIntelligenceInput): OwnershipCell[] {
  const byActor = new Map<string, OwnershipCell>();

  for (const item of input.queueItems) {
    if (["completed", "cancelled"].includes(item.state)) continue;
    const actorKey = item.assignedTo ?? "__unowned__";
    const dept = item.ownerDepartment ?? "unassigned";
    const cell = byActor.get(actorKey) ?? {
      actorKey,
      department: dept,
      assignedCount: 0,
      agingCount: 0,
      overloaded: false,
    };
    cell.assignedCount += 1;
    const sla = assessQueueSla(item, input.nowIso);
    if (sla.severity === "aging" || sla.severity === "breached" || sla.severity === "critical") {
      cell.agingCount += 1;
    }
    byActor.set(actorKey, cell);
  }

  return [...byActor.values()]
    .map((c) => ({ ...c, overloaded: c.assignedCount >= OVERLOAD_THRESHOLD }))
    .sort((a, b) => b.assignedCount - a.assignedCount);
}

export function countUnownedQueues(input: ExecutionIntelligenceInput): number {
  return input.queueItems.filter(
    (i) => !["completed", "cancelled"].includes(i.state) && !i.assignedTo,
  ).length;
}
