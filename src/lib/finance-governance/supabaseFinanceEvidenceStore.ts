import type { SupabaseClient } from "@supabase/supabase-js";
import { validateFinanceEvidenceInsert } from "./financeEvidenceModel";
import type { FinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import type {
  FinanceEvidenceRecord,
  FinanceReviewStatus,
  FinanceReviewType,
} from "./financeGovernanceTypes";

interface FinanceEvidenceRow {
  id: string;
  order_id: string;
  review_type: string;
  review_status: string;
  evidence_type: string;
  evidence_ref: string | null;
  utr_ref: string | null;
  amount: number | null;
  currency: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  override_reason: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function mapRow(row: FinanceEvidenceRow): FinanceEvidenceRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    reviewType: row.review_type as FinanceReviewType,
    reviewStatus: row.review_status as FinanceReviewStatus,
    evidenceType: row.evidence_type,
    evidenceRef: row.evidence_ref,
    utrRef: row.utr_ref,
    amount: row.amount,
    currency: row.currency,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    overrideReason: row.override_reason,
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function toInsert(row: Omit<FinanceEvidenceRecord, "id" | "createdAt">): Record<string, unknown> {
  return {
    order_id: row.orderId,
    review_type: row.reviewType,
    review_status: row.reviewStatus,
    evidence_type: row.evidenceType,
    evidence_ref: row.evidenceRef,
    utr_ref: row.utrRef,
    amount: row.amount,
    currency: row.currency,
    actor_id: row.actorId,
    actor_role: row.actorRole,
    actor_department: row.actorDepartment,
    override_reason: row.overrideReason,
    correlation_id: row.correlationId,
    metadata: row.metadata ?? {},
  };
}

export function createSupabaseFinanceEvidenceStore(client: SupabaseClient): FinanceEvidenceStore {
  return {
    async insertEvidence(row) {
      validateFinanceEvidenceInsert(row);
      const { data, error } = await client
        .from("finance_review_evidence")
        .insert(toInsert(row))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as FinanceEvidenceRow);
    },
    async listByOrder(orderId) {
      const { data, error } = await client
        .from("finance_review_evidence")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as FinanceEvidenceRow[]).map(mapRow);
    },
  };
}

export async function probeFinanceEvidenceTable(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from("finance_review_evidence").select("id").limit(1);
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("does not exist") || msg.includes("42p01")) return false;
  throw new Error(error.message);
}
