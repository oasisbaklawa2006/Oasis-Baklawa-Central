import type { QueueItemRow } from "./queueRowMapper";
import type { QueueStoreAdapter } from "./persistentQueueRepository";

export function createInMemoryQueueStore(): QueueStoreAdapter & { _reset: () => void } {
  const items = new Map<string, QueueItemRow>();
  const assignments: { id: string; queue_item_id: string }[] = [];

  return {
    async getRow(id: string) {
      return items.get(id) ?? null;
    },

    async insertRow(row) {
      const id = crypto.randomUUID();
      const full: QueueItemRow = {
        id,
        queue_type: row.queue_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        order_id: row.order_id ?? null,
        customer_id: row.customer_id ?? null,
        title: row.title,
        summary: row.summary ?? null,
        priority: row.priority ?? "normal",
        state: row.state ?? "pending",
        owner_department: row.owner_department ?? null,
        assigned_to: row.assigned_to ?? null,
        escalation_level: row.escalation_level ?? "none",
        blocker_code: row.blocker_code ?? null,
        blocker_summary: row.blocker_summary ?? null,
        sla_due_at: row.sla_due_at ?? null,
        source: row.source ?? "execution_os",
        version: row.version ?? 1,
        created_by: row.created_by ?? null,
        updated_by: row.updated_by ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
        completed_at: row.completed_at ?? null,
        cancelled_at: row.cancelled_at ?? null,
      };
      items.set(id, full);
      return full;
    },

    async updateRow(id, expectedVersion, patch) {
      const current = items.get(id);
      if (!current) throw new Error("Queue item not found");
      if (current.version !== expectedVersion) {
        throw new Error(`Stale queue version: expected ${expectedVersion}, got ${current.version}`);
      }
      const next: QueueItemRow = {
        ...current,
        ...patch,
        id: current.id,
        version: (patch.version as number) ?? current.version + 1,
      };
      items.set(id, next);
      return next;
    },

    async insertAssignment(row) {
      const id = crypto.randomUUID();
      assignments.push({ id, queue_item_id: row.queue_item_id });
      return { id };
    },

    _reset() {
      items.clear();
      assignments.length = 0;
    },
  };
}
