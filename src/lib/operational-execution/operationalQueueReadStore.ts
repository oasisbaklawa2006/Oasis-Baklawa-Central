import type { SupabaseClient } from "@supabase/supabase-js";
import { isOpenQueueState } from "@/lib/persistent-queues/queueLifecycle";
import { mapQueueRow, type MappedQueueItem, type QueueItemRow } from "@/lib/persistent-queues/queueRowMapper";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { ListDepartmentQueueItemsFilter, ListOpenQueueItemsFilter } from "./operationalExecutionTypes";

/**
 * QUARANTINED — Point86: operational_queue_items is a dead projection with no
 * proven Core writer for department execution workloads. New reads must use
 * `@/lib/department-queues` canonical Core authority instead. This store remains
 * only for legacy preview/dev paths until fully retired.
 */
export const OPERATIONAL_QUEUE_ITEMS_QUARANTINED = true;

export interface OperationalQueueReadStore {
  getQueueItem(id: string): Promise<MappedQueueItem | null>;
  listOpenQueueItems(filter?: ListOpenQueueItemsFilter): Promise<MappedQueueItem[]>;
  listDepartmentQueueItems(filter: ListDepartmentQueueItemsFilter): Promise<MappedQueueItem[]>;
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

    async listDepartmentQueueItems(filter) {
      const limit = filter.limit ?? 200;
      const openQuery = client
        .from("operational_queue_items")
        .select("*")
        .in("queue_type", filter.queueTypes)
        .order("updated_at", { ascending: false })
        .limit(limit);
      const { data: openData, error: openErr } = await openQuery;
      if (openErr) throw new Error(openErr.message);
      let rows = (openData ?? []) as QueueItemRow[];
      if (filter.includeCompletedToday) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const { data: doneData, error: doneErr } = await client
          .from("operational_queue_items")
          .select("*")
          .in("queue_type", filter.queueTypes)
          .eq("state", "completed")
          .gte("completed_at", dayStart.toISOString())
          .order("completed_at", { ascending: false })
          .limit(50);
        if (!doneErr && doneData) {
          const ids = new Set(rows.map((r) => r.id));
          for (const r of doneData as QueueItemRow[]) {
            if (!ids.has(r.id)) rows.push(r);
          }
        }
      }
      const mapped = rows.map(mapQueueRow);
      const open = mapped.filter((i) => isOpenQueueState(i.state));
      const doneToday = mapped.filter((i) => i.state === "completed");
      const merged = [...open, ...doneToday.filter((d) => !open.some((o) => o.id === d.id))];
      return merged.slice(0, limit);
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

    async listDepartmentQueueItems(filter) {
      const rows = await store.listRows();
      const mapped = rows
        .map(mapQueueRow)
        .filter((i) => filter.queueTypes.includes(i.queueType));
      const open = mapped.filter((i) => isOpenQueueState(i.state));
      const done = filter.includeCompletedToday
        ? mapped.filter((i) => i.state === "completed")
        : [];
      return [...open, ...done.filter((d) => !open.some((o) => o.id === d.id))].slice(0, filter.limit ?? 200);
    },
  };
}
