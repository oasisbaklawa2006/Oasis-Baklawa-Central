import type { ExecutionIntelligenceInput } from "./executionIntelligenceTypes";

const COMPLETE_EVENTS = new Set(["queue_completed", "scan_verified", "gate_scan_verified", "department_handoff_verified"]);

export function buildDepartmentThroughput(input: ExecutionIntelligenceInput) {
  const windowMs = 24 * 60 * 60 * 1000;
  const now = new Date(input.nowIso).getTime();
  const byDept = new Map<string, { department: string; completedEvents24h: number; openQueues: number }>();

  for (const item of input.queueItems) {
    if (["completed", "cancelled"].includes(item.state)) continue;
    const dept = item.ownerDepartment ?? "unassigned";
    const cell = byDept.get(dept) ?? { department: dept, completedEvents24h: 0, openQueues: 0 };
    cell.openQueues += 1;
    byDept.set(dept, cell);
  }

  for (const ev of input.events) {
    if (!COMPLETE_EVENTS.has(ev.eventType)) continue;
    const created = new Date(ev.createdAt).getTime();
    if (now - created > windowMs) continue;
    const dept = ev.actorDepartment ?? "unknown";
    const cell = byDept.get(dept) ?? { department: dept, completedEvents24h: 0, openQueues: 0 };
    cell.completedEvents24h += 1;
    byDept.set(dept, cell);
  }

  return [...byDept.values()].sort((a, b) => b.openQueues - a.openQueues);
}
