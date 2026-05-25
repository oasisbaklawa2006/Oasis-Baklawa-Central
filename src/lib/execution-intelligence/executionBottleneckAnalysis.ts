import type { BottleneckNode, ExecutionIntelligenceInput } from "./executionIntelligenceTypes";

export function analyzeExecutionBottlenecks(input: ExecutionIntelligenceInput): BottleneckNode[] {
  const nodes: BottleneckNode[] = [];
  const byDept = new Map<string, ExecutionIntelligenceInput["queueItems"]>();

  for (const item of input.queueItems) {
    if (["completed", "cancelled"].includes(item.state)) continue;
    const dept = item.ownerDepartment ?? "unassigned";
    const list = byDept.get(dept) ?? [];
    list.push(item);
    byDept.set(dept, list);
  }

  let depth = 0;
  for (const [department, items] of byDept) {
    const blocked = items.filter((i) => i.state === "blocked" || i.blockerCode);
    const id = `dept:${department}`;
    nodes.push({
      id,
      label: `${department} (${items.length} open)`,
      department,
      depth,
      blocked: blocked.length > 0,
      childIds: blocked.map((b) => `item:${b.id}`),
    });
    for (const b of blocked.slice(0, 5)) {
      nodes.push({
        id: `item:${b.id}`,
        label: b.title,
        department,
        depth: depth + 1,
        blocked: true,
        childIds: b.orderId ? [`order:${b.orderId}`] : [],
      });
    }
    depth += 1;
  }

  return nodes.sort((a, b) => Number(b.blocked) - Number(a.blocked) || a.depth - b.depth);
}
