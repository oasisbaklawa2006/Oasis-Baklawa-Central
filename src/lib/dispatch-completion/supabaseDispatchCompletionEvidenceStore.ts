import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCompletionEvidenceInsert } from "./dispatchCompletionEvidence";
import type { DispatchCompletionEvidenceStore } from "./inMemoryDispatchCompletionEvidenceStore";
import type {
  DispatchCompletionEvidenceRecord,
  DispatchCompletionEvidenceStatus,
  DispatchCompletionEvidenceType,
  DispatchCompletionStatus,
} from "./dispatchCompletionTypes";

interface DispatchCompletionEvidenceRow {
  id: string;
  order_id: string;
  queue_item_id: string | null;
  evidence_type: string;
  evidence_status: string;
  completion_status: string;
  evidence_ref: string | null;
  courier_ref: string | null;
  manifest_ref: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  override_reason: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapRow(row: DispatchCompletionEvidenceRow): DispatchCompletionEvidenceRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    queueItemId: row.queue_item_id,
    evidenceType: row.evidence_type as DispatchCompletionEvidenceType,
    evidenceStatus: row.evidence_status as DispatchCompletionEvidenceStatus,
    completionStatus: row.completion_status as DispatchCompletionStatus,
    evidenceRef: row.evidence_ref,
    courierRef: row.courier_ref,
    manifestRef: row.manifest_ref,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    overrideReason: row.override_reason,
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function toInsertRow(row: Omit<DispatchCompletionEvidenceRecord, "id" | "createdAt">): Record<string, unknown> {
  return {
    order_id: row.orderId,
    queue_item_id: row.queueItemId,
    evidence_type: row.evidenceType,
    evidence_status: row.evidenceStatus,
    completion_status: row.completionStatus,
    evidence_ref: row.evidenceRef,
    courier_ref: row.courierRef,
    manifest_ref: row.manifestRef,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    actor_department: row.actorDepartment,
    override_reason: row.overrideReason,
    correlation_id: row.correlationId,
    metadata: row.metadata ?? {},
  };
}

export function createSupabaseDispatchCompletionEvidenceStore(
  client: SupabaseClient,
): DispatchCompletionEvidenceStore {
  return {
    async insertEvidence(row) {
      validateCompletionEvidenceInsert(row);
      const { data, error } = await client
        .from("dispatch_completion_evidence")
        .insert(toInsertRow(row))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as DispatchCompletionEvidenceRow);
    },

    async listByOrder(orderId) {
      const { data, error } = await client
        .from("dispatch_completion_evidence")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as DispatchCompletionEvidenceRow[]).map(mapRow);
    },
  };
}

export async function probeDispatchCompletionEvidenceTable(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from("dispatch_completion_evidence").select("id").limit(1);
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("does not exist") || msg.includes("42p01")) return false;
  throw new Error(error.message);
}
