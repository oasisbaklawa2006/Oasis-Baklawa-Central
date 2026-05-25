import type { SupabaseClient } from "@supabase/supabase-js";
import { isOpenQueueState } from "@/lib/persistent-queues/queueLifecycle";
import { mapQueueRow, type MappedQueueItem, type QueueItemRow } from "@/lib/persistent-queues/queueRowMapper";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { ListOpenQueueItemsFilter } from "./operationalExecutionTypes";

export interface OperationalQueueReadStore {
  getQueueItem(id: string): Promise<MappedQueueItem | null>;
  listOpenQueueItems(filter?: ListOpenQueueItemsFilter): Promise<MappedQueueItem[]>;
}

function filterOpenRows(rows: QueueItemRow[], filter?: ListOpenQueueItemsFilter): MappedQueueItem[] {
  let mapped = rows
    .map(mapQueueRow)
    .filter((item) => isOpenQueueState(item.state));
  if (filter?.queueType) {
    mapped = mapped.filter((item) => item.queueType === filter.queueType);
  }
  if (filter?.limit != null && filter.limit > 0) {
    mapped = mapped.slice(0, filter.limit);
  }
  return mapped;
}

export function createSupabaseOperationalQueueReadStore(client: SupabaseClient): OperationalQueueReadStore {
  return {
    async getQueueItem(id: string) {
      const { data, error } = await client
        .from("operational_queue_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapQueueRow(data as QueueItemRow);
    },

    async listOpenQueueItems(filter) {
      let query = client.from("operational_queue_items").select("*").order("updated_at", { ascending: false });
      if (filter?.queueType) {
        query = query.eq("queue_type", filter.queueType);
      }
      const limit = filter?.limit ?? 100;
      query = query.limit(Math.min(limit * 3, 500));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return filterOpenRows((data ?? []) as QueueItemRow[], { ...filter, limit });
    },
  };
}

export function createInMemoryOperationalQueueReadStore(
  store: { getRow(id: string): Promise<QueueItemRow | null>; listRows(): Promise<QueueItemRow[]> },
): OperationalQueueReadStore {
  return {
    async getQueueItem(id: string) {
      const row = await store.getRow(id);
      return row ? mapQueueRow(row) : null;
    },

    async listOpenQueueItems(filter) {
      const rows = await store.listRows();
      return filterOpenRows(rows, filter);
    },
  };
}
