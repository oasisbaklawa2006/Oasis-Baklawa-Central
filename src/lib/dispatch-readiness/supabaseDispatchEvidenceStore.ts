import type { SupabaseClient } from "@supabase/supabase-js";
import { validateEvidenceInsert } from "./dispatchReadinessEvidence";
import type { DispatchEvidenceStore } from "./inMemoryDispatchEvidenceStore";
import type { DispatchEvidenceRecord, DispatchEvidenceStatus, DispatchEvidenceType } from "./dispatchReadinessTypes";

interface DispatchEvidenceRow {
  id: string;
  order_id: string;
  queue_item_id: string | null;
  evidence_type: string;
  evidence_status: string;
  evidence_ref: string | null;
  photo_ref: string | null;
  document_ref: string | null;
  barcode_ref: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapRow(row: DispatchEvidenceRow): DispatchEvidenceRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    queueItemId: row.queue_item_id,
    evidenceType: row.evidence_type as DispatchEvidenceType,
    evidenceStatus: row.evidence_status as DispatchEvidenceStatus,
    evidenceRef: row.evidence_ref,
    photoRef: row.photo_ref,
    documentRef: row.document_ref,
    barcodeRef: row.barcode_ref,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function toInsertRow(row: Omit<DispatchEvidenceRecord, "id" | "createdAt">): Record<string, unknown> {
  return {
    order_id: row.orderId,
    queue_item_id: row.queueItemId,
    evidence_type: row.evidenceType,
    evidence_status: row.evidenceStatus,
    evidence_ref: row.evidenceRef,
    photo_ref: row.photoRef,
    document_ref: row.documentRef,
    barcode_ref: row.barcodeRef,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    actor_department: row.actorDepartment,
    correlation_id: row.correlationId,
    metadata: row.metadata ?? {},
  };
}

export function createSupabaseDispatchEvidenceStore(client: SupabaseClient): DispatchEvidenceStore {
  return {
    async insertEvidence(row) {
      validateEvidenceInsert(row);
      const { data, error } = await client
        .from("dispatch_readiness_evidence")
        .insert(toInsertRow(row))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as DispatchEvidenceRow);
    },

    async listByOrder(orderId) {
      const { data, error } = await client
        .from("dispatch_readiness_evidence")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as DispatchEvidenceRow[]).map(mapRow);
    },
  };
}

export async function probeDispatchEvidenceTable(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from("dispatch_readiness_evidence").select("id").limit(1);
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("does not exist") || msg.includes("42p01")) return false;
  throw new Error(error.message);
}
