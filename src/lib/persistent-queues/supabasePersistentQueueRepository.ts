import type { SupabaseClient } from "@supabase/supabase-js";
import { createInMemoryOperationalEventRepository } from "@/lib/operational-events/inMemoryOperationalEventRepository";
import { createSupabaseOperationalEventRepository } from "@/lib/operational-events/supabaseOperationalEventRepository";
import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import { createInMemoryQueueStore } from "./inMemoryQueueStore";
import { createPersistentQueueRepository, type PersistentQueueWriteService } from "./persistentQueueRepository";
import type { QueueItemRow } from "./queueRowMapper";
import type { QueueStoreAdapter } from "./persistentQueueRepository";

function createSupabaseQueueStore(client: SupabaseClient): QueueStoreAdapter {
  return {
    async getRow(id: string) {
      const { data, error } = await client.from("operational_queue_items").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data as QueueItemRow | null;
    },

    async insertRow(row) {
      const { data, error } = await client
        .from("operational_queue_items")
        .insert({
          queue_type: row.queue_type,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          order_id: row.order_id,
          customer_id: row.customer_id,
          title: row.title,
          summary: row.summary,
          priority: row.priority,
          state: row.state,
          owner_department: row.owner_department,
          assigned_to: row.assigned_to,
          escalation_level: row.escalation_level,
          blocker_code: row.blocker_code,
          blocker_summary: row.blocker_summary,
          sla_due_at: row.sla_due_at,
          source: row.source,
          version: row.version,
          created_by: row.created_by,
          updated_by: row.updated_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          completed_at: row.completed_at,
          cancelled_at: row.cancelled_at,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as QueueItemRow;
    },

    async updateRow(id, expectedVersion, patch) {
      const current = await this.getRow(id);
      if (!current) throw new Error("Queue item not found");
      if (current.version !== expectedVersion) {
        throw new Error(`Stale queue version: expected ${expectedVersion}, got ${current.version}`);
      }
      const { data, error } = await client
        .from("operational_queue_items")
        .update({
          ...patch,
          version: patch.version ?? expectedVersion + 1,
        })
        .eq("id", id)
        .eq("version", expectedVersion)
        .select()
        .single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Stale queue version: concurrent update");
      return data as QueueItemRow;
    },

    async insertAssignment(row) {
      const { data, error } = await client
        .from("operational_queue_assignments")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: (data as { id: string }).id };
    },
  };
}

export interface SupabasePersistentQueueBundle {
  repository: PersistentQueueWriteService;
  events: OperationalEventRepository;
}

/** Wired Supabase queue + event repositories (no UI). */
export function createSupabasePersistentQueueBundle(client: SupabaseClient): SupabasePersistentQueueBundle {
  const events = createSupabaseOperationalEventRepository(client);
  const store = createSupabaseQueueStore(client);
  return {
    repository: createPersistentQueueRepository(store, events),
    events,
  };
}

/** Test/dev bundle without network. */
export function createInMemoryPersistentQueueBundle(): SupabasePersistentQueueBundle & {
  reset: () => void;
} {
  const events = createInMemoryOperationalEventRepository();
  const store = createInMemoryQueueStore();
  return {
    repository: createPersistentQueueRepository(store, events),
    events,
    reset: () => {
      events._reset();
      store._reset();
    },
  };
}
