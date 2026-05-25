import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

export function ExecutionOwnershipPanel({ item }: { item: MappedQueueItem | null }) {
  if (!item) return null;
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <dt className="text-muted-foreground">Assigned</dt>
        <dd className="font-medium">{item.assignedTo ?? "Unowned"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Department</dt>
        <dd>{item.ownerDepartment ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Version</dt>
        <dd className="font-mono">{item.version}</dd>
      </div>
    </dl>
  );
}
