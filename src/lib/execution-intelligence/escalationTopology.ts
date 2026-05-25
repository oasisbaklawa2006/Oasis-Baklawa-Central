import type { EscalationHotspot, ExecutionIntelligenceInput } from "./executionIntelligenceTypes";

export function buildEscalationTopology(input: ExecutionIntelligenceInput): EscalationHotspot[] {
  const byDept = new Map<string, EscalationHotspot>();

  for (const item of input.queueItems) {
    if (["completed", "cancelled"].includes(item.state)) continue;
    const dept = item.ownerDepartment ?? "unassigned";
    const cell = byDept.get(dept) ?? {
      department: dept,
      escalationCount: 0,
      blockedCount: 0,
      queueTypes: [],
    };
    if (item.escalationLevel !== "none") cell.escalationCount += 1;
    if (item.state === "blocked" || item.blockerCode) cell.blockedCount += 1;
    if (!cell.queueTypes.includes(item.queueType)) cell.queueTypes.push(item.queueType);
    byDept.set(dept, cell);
  }

  for (const ev of input.events) {
    if (!ev.eventType.includes("escalat") && !ev.eventType.includes("failed")) continue;
    const dept = (ev.actorDepartment as string) ?? "events";
    const cell = byDept.get(dept) ?? {
      department: dept,
      escalationCount: 0,
      blockedCount: 0,
      queueTypes: [],
    };
    cell.escalationCount += 1;
    byDept.set(dept, cell);
  }

  return [...byDept.values()].sort(
    (a, b) => b.escalationCount + b.blockedCount - (a.escalationCount + a.blockedCount),
  );
}

export function deriveBlockerPropagationDepth(input: ExecutionIntelligenceInput): number {
  const blocked = input.queueItems.filter((i) => i.state === "blocked" || i.blockerCode);
  const orders = new Set(blocked.map((b) => b.orderId).filter(Boolean));
  return orders.size > 0 ? Math.min(5, blocked.length) : blocked.length > 0 ? 1 : 0;
}
