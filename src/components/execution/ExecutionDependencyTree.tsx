import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

export function ExecutionDependencyTree({ item }: { item: MappedQueueItem | null }) {
  if (!item) return null;
  return (
    <ul className="space-y-1 font-mono text-[10px] text-muted-foreground">
      <li>entity: {item.entityType}/{item.entityId.slice(0, 8)}…</li>
      {item.orderId ? <li>order: {item.orderId.slice(0, 8)}…</li> : null}
      <li>queue: {item.queueType}</li>
      <li>risk: {item.blockerCode ? "dependency blocked" : "no blocker code"}</li>
    </ul>
  );
}
