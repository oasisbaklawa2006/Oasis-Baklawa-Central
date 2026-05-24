import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAppendOnlyMutation } from "./operationalEventImmutability";
import { assertSafeEventMetadata, normalizeEventVisibility } from "./eventVisibility";
import type { AppendOperationalEventInput, OperationalStoreEventRecord } from "./operationalEventTypes";
import type { OperationalEventRepository } from "./operationalEventRepository";

type EventRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  order_id: string | null;
  customer_id: string | null;
  queue_item_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  visibility: string;
  severity: string;
  title: string;
  message: string | null;
  reason_code: string | null;
  reason_text: string | null;
  metadata: Record<string, unknown>;
  correlation_id: string;
  idempotency_key: string | null;
  created_at: string;
};

function mapRow(row: EventRow): OperationalStoreEventRecord {
  return {
    id: row.id,
    eventType: row.event_type as OperationalStoreEventRecord["eventType"],
    entityType: row.entity_type,
    entityId: row.entity_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    queueItemId: row.queue_item_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    visibility: row.visibility as OperationalStoreEventRecord["visibility"],
    severity: row.severity as OperationalStoreEventRecord["severity"],
    title: row.title,
    message: row.message,
    reasonCode: row.reason_code,
    reasonText: row.reason_text,
    metadata: row.metadata ?? {},
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

export function createSupabaseOperationalEventRepository(
  client: SupabaseClient,
): OperationalEventRepository {
  return {
    async appendEvent(input: AppendOperationalEventInput): Promise<OperationalStoreEventRecord> {
      assertAppendOnlyMutation("insert");
      if (!input.correlationId?.trim()) {
        throw new Error("operational event requires correlation_id");
      }
      if (input.idempotencyKey) {
        const existing = await this.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      const { data, error } = await client
        .from("operational_events")
        .insert({
          event_type: input.eventType,
          entity_type: input.entityType,
          entity_id: input.entityId,
          order_id: input.orderId ?? null,
          customer_id: input.customerId ?? null,
          queue_item_id: input.queueItemId ?? null,
          actor_id: input.actorId,
          actor_role: input.actorRole,
          actor_department: input.actorDepartment ?? null,
          visibility: normalizeEventVisibility(input.visibility),
          severity: input.severity ?? "info",
          title: input.title,
          message: input.message ?? null,
          reason_code: input.reasonCode ?? null,
          reason_text: input.reasonText ?? null,
          metadata: assertSafeEventMetadata(input.metadata ?? {}),
          correlation_id: input.correlationId,
          idempotency_key: input.idempotencyKey ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as EventRow);
    },

    async findByIdempotencyKey(key: string) {
      const { data, error } = await client
        .from("operational_events")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data as EventRow) : null;
    },

    async listByEntity(entityType: string, entityId: string, limit = 50) {
      const { data, error } = await client
        .from("operational_events")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data as EventRow[]).map(mapRow).reverse();
    },

    async listByQueueItem(queueItemId: string, limit = 50) {
      const { data, error } = await client
        .from("operational_events")
        .select("*")
        .eq("queue_item_id", queueItemId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data as EventRow[]).map(mapRow).reverse();
    },
  };
}
