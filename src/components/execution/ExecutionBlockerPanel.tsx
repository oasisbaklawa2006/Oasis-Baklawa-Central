import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

export function ExecutionBlockerPanel({ item }: { item: MappedQueueItem | null }) {
  if (!item?.blockerCode && !item?.blockerSummary) {
    return <p className="text-xs text-muted-foreground">No active blocker</p>;
  }
  return (
    <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
      <p className="font-medium">{item.blockerCode ?? "blocked"}</p>
      <p>{item.blockerSummary}</p>
    </div>
  );
}
