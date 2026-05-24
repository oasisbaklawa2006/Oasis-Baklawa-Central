import type { WorkQueueItem, WorkQueueId } from "./queueTypes";
import type { OperationalOwnerRole } from "@/lib/entity-graph/entityOwnership";
import type { EntityPriorityBand } from "@/lib/entity-graph/entityPriority";

export interface QueueGroupByOwner {
  ownerRole: OperationalOwnerRole;
  items: WorkQueueItem[];
}

export interface QueueGroupByPriority {
  priority: EntityPriorityBand;
  items: WorkQueueItem[];
}

export function groupQueueItemsByOwner(items: WorkQueueItem[]): QueueGroupByOwner[] {
  const map = new Map<OperationalOwnerRole, WorkQueueItem[]>();
  for (const item of items) {
    const list = map.get(item.ownerRole) ?? [];
    list.push(item);
    map.set(item.ownerRole, list);
  }
  return [...map.entries()].map(([ownerRole, groupItems]) => ({ ownerRole, items: groupItems }));
}

export function groupQueueItemsByPriority(items: WorkQueueItem[]): QueueGroupByPriority[] {
  const order: EntityPriorityBand[] = ["critical", "urgent", "elevated", "routine"];
  const map = new Map<EntityPriorityBand, WorkQueueItem[]>();
  for (const item of items) {
    const list = map.get(item.priority) ?? [];
    list.push(item);
    map.set(item.priority, list);
  }
  return order.filter((p) => map.has(p)).map((priority) => ({ priority, items: map.get(priority)! }));
}

export function groupItemsByQueueId(items: WorkQueueItem[]): Map<WorkQueueId, WorkQueueItem[]> {
  const map = new Map<WorkQueueId, WorkQueueItem[]>();
  for (const item of items) {
    const list = map.get(item.queueId) ?? [];
    list.push(item);
    map.set(item.queueId, list);
  }
  return map;
}
