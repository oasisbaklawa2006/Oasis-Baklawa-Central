import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLineageInsert } from "./dispatchLineage";
import type {
  DispatchLineageStore,
  DispatchReleaseLineageRecord,
  DispatchReleaseType,
  OrderDispatchStatusRepository,
  OrderDispatchStatusUpdateParams,
} from "./dispatchFinalizationTypes";

interface LineageRow {
  id: string;
  order_id: string;
  previous_status: string;
  next_status: string;
  release_reason: string | null;
  release_type: string;
  transporter_reference: string | null;
  gate_reference: string | null;
  completion_reference: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  override_reason: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapLineage(row: LineageRow): DispatchReleaseLineageRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    releaseReason: row.release_reason,
    releaseType: row.release_type as DispatchReleaseType,
    transporterReference: row.transporter_reference,
    gateReference: row.gate_reference,
    completionReference: row.completion_reference,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    overrideReason: row.override_reason,
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function toLineageInsert(row: Omit<DispatchReleaseLineageRecord, "id" | "createdAt">): Record<string, unknown> {
  return {
    order_id: row.orderId,
    previous_status: row.previousStatus,
    next_status: row.nextStatus,
    release_reason: row.releaseReason,
    release_type: row.releaseType,
    transporter_reference: row.transporterReference,
    gate_reference: row.gateReference,
    completion_reference: row.completionReference,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    actor_department: row.actorDepartment,
    override_reason: row.overrideReason,
    correlation_id: row.correlationId,
    metadata: row.metadata ?? {},
  };
}

export function createSupabaseDispatchLineageStore(client: SupabaseClient): DispatchLineageStore {
  return {
    async insertLineage(row) {
      validateLineageInsert(row);
      const { data, error } = await client
        .from("dispatch_release_lineage")
        .insert(toLineageInsert(row))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapLineage(data as LineageRow);
    },
    async listByOrder(orderId) {
      const { data, error } = await client
        .from("dispatch_release_lineage")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as LineageRow[]).map(mapLineage);
    },
  };
}

export function createSupabaseOrderDispatchStatusRepository(client: SupabaseClient): OrderDispatchStatusRepository {
  return {
    async getOrderStatus(orderId) {
      const { data, error } = await client.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { status: data.status as string } : null;
    },

    async updateOrderDispatchStatus(params: OrderDispatchStatusUpdateParams) {
      const patch: Record<string, unknown> = { status: params.nextStatus };
      if (params.trackingNumber !== undefined) patch.tracking_number = params.trackingNumber;
      if (params.courierName !== undefined) patch.courier_name = params.courierName;

      const { data, error } = await client
        .from("orders")
        .update(patch)
        .eq("id", params.orderId)
        .eq("status", params.expectedPreviousStatus)
        .select("status")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        return {
          updated: false,
          previousStatus: params.expectedPreviousStatus,
          nextStatus: params.expectedPreviousStatus,
        };
      }
      return {
        updated: true,
        previousStatus: params.expectedPreviousStatus,
        nextStatus: data.status as string,
      };
    },

    async insertStatusHistory(params) {
      const row: Record<string, unknown> = {
        order_id: params.orderId,
        old_status: params.oldStatus,
        new_status: params.newStatus,
      };
      if (params.actorId?.trim()) {
        row.changed_by = params.actorId;
      }
      const { error } = await client.from("order_status_history").insert(row);
      if (error) throw new Error(error.message);
    },
  };
}

export async function probeDispatchReleaseLineageTable(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from("dispatch_release_lineage").select("id").limit(1);
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("does not exist") || msg.includes("42p01")) return false;
  throw new Error(error.message);
}
