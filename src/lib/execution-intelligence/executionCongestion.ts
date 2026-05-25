import type { CongestionCell, ExecutionIntelligenceInput } from "./executionIntelligenceTypes";
import { assessQueueSla } from "./slaBreachDetection";

export function buildCongestionHeatmap(input: ExecutionIntelligenceInput): CongestionCell[] {
  const byDept = new Map<string, CongestionCell>();

  for (const item of input.queueItems) {
    if (["completed", "cancelled"].includes(item.state)) continue;
    const dept = item.ownerDepartment ?? "unassigned";
    const cell = byDept.get(dept) ?? {
      department: dept,
      openCount: 0,
      breachedCount: 0,
      blockedCount: 0,
      heat: 0,
    };
    cell.openCount += 1;
    const sla = assessQueueSla(item, input.nowIso);
    if (sla.severity === "breached" || sla.severity === "critical") cell.breachedCount += 1;
    if (item.state === "blocked" || item.blockerCode) cell.blockedCount += 1;
    byDept.set(dept, cell);
  }

  return [...byDept.values()]
    .map((c) => ({
      ...c,
      heat: c.openCount + c.breachedCount * 2 + c.blockedCount * 3,
    }))
    .sort((a, b) => b.heat - a.heat);
}
