import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { assertPersistedDraftExtractionMatch } from "./assertPersistedDraftExtractionMatch";
import {
  isExtractionVersionStale,
  STALE_EXTRACTION_DRAFT_MESSAGE,
} from "./draftIntegrityContract";
import {
  buildOperatorFinalSnapshot,
  buildDraftHeaderRpcPayload,
  buildDraftLineRpcPayloads,
} from "./mapExtractedDraft";
import type {
  CreateSalesOrderDraftInput,
  SalesOrderDraftAuditEntry,
  SalesOrderDraftBundle,
  SalesOrderDraftRow,
  SalesOrderDraftStatus,
  SubmitSalesOrderDraftForReviewInput,
  TransitionSalesOrderDraftInput,
} from "./types";

function parseDraftRow(row: Database["public"]["Tables"]["sales_order_drafts"]["Row"]): SalesOrderDraftRow {
  return {
    ...row,
    status: row.status as SalesOrderDraftStatus,
    readiness_dimensions:
      (row.readiness_dimensions as unknown as SalesOrderDraftRow["readiness_dimensions"]) ?? [],
    ai_draft_snapshot: row.ai_draft_snapshot as unknown as ExtractedDraftOrder,
    operator_final_snapshot:
      row.operator_final_snapshot as unknown as SalesOrderDraftRow["operator_final_snapshot"],
  };
}

export async function fetchDraftLinesAndAudit(draftId: string): Promise<{
  lines: SalesOrderDraftBundle["lines"];
  auditLog: SalesOrderDraftAuditEntry[];
}> {
  const [{ data: lines, error: linesError }, { data: auditLog, error: auditError }] =
    await Promise.all([
      supabase
        .from("sales_order_draft_lines")
        .select("*")
        .eq("draft_id", draftId)
        .order("line_index", { ascending: true }),
      supabase
        .from("sales_order_draft_audit_log")
        .select("*")
        .eq("draft_id", draftId)
        .order("created_at", { ascending: true }),
    ]);

  if (linesError) throw new Error(linesError.message);
  if (auditError) throw new Error(auditError.message);

  return {
    lines: (lines ?? []) as SalesOrderDraftBundle["lines"],
    auditLog: (auditLog ?? []) as SalesOrderDraftAuditEntry[],
  };
}

export async function fetchSalesOrderDraftByPacket(
  packetId: string,
): Promise<SalesOrderDraftBundle | null> {
  const { data: drafts, error: draftError } = await supabase
    .from("sales_order_drafts")
    .select("*")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (draftError) throw new Error(draftError.message);
  if (!drafts?.length) return null;

  const draft = parseDraftRow(drafts[0]);

  const { lines, auditLog } = await fetchDraftLinesAndAudit(draft.id);

  return {
    draft,
    lines,
    auditLog,
  };
}

export async function createSalesOrderDraft(
  input: CreateSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  const existing = await fetchSalesOrderDraftByPacket(input.extracted.packetId);
  if (existing) {
    if (existing.draft.status === "REJECTED") {
      // allow new draft after terminal rejection
    } else if (
      isExtractionVersionStale({
        persistedExtractionRequestKey: existing.draft.extraction_request_key,
        liveExtractionRequestKey: input.extracted.extractionRequestKey,
      })
    ) {
      throw new Error(STALE_EXTRACTION_DRAFT_MESSAGE);
    } else {
      return existing;
    }
  }

  const { data: draftId, error: createError } = await supabase.rpc("create_sales_order_draft_atomic", {
    p_header: buildDraftHeaderRpcPayload(input) as Json,
    p_lines: buildDraftLineRpcPayloads(input.extracted, input.operatorLineQuantities) as Json,
    p_actor_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_audit_metadata: {
      packetId: input.extracted.packetId,
      extractionRequestKey: input.extracted.extractionRequestKey,
      readinessScore: input.extracted.readiness.overallScore,
    } as Json,
  });

  if (createError) {
    if (createError.message.includes("Active sales order draft already exists")) {
      const retryBundle = await fetchSalesOrderDraftByPacket(input.extracted.packetId);
      if (retryBundle) {
        if (
          retryBundle.draft.status !== "REJECTED" &&
          isExtractionVersionStale({
            persistedExtractionRequestKey: retryBundle.draft.extraction_request_key,
            liveExtractionRequestKey: input.extracted.extractionRequestKey,
          })
        ) {
          throw new Error(STALE_EXTRACTION_DRAFT_MESSAGE);
        }
        if (retryBundle.draft.status !== "REJECTED") {
          return retryBundle;
        }
      }
    }
    throw new Error(createError.message);
  }

  if (draftId) {
    const byId = await fetchSalesOrderDraftById(draftId);
    if (byId) return byId;
  }

  const bundle = await fetchSalesOrderDraftByPacket(input.extracted.packetId);
  if (!bundle) throw new Error("Failed to reload created sales order draft.");
  return bundle;
}

export async function submitSalesOrderDraftForReviewWithOperatorSync(
  input: SubmitSalesOrderDraftForReviewInput,
): Promise<SalesOrderDraftBundle> {
  if (!input.extracted) {
    throw new Error("Draft extraction must be ready before submitting for review.");
  }

  const draftHeader = await fetchDraftHeaderForMutation(input.draftId);
  assertPersistedDraftExtractionMatch({
    extracted: input.extracted,
    extractionRequestKey: draftHeader.extraction_request_key,
    status: draftHeader.status,
    actionLabel: "submit for review",
  });

  const operatorFinal = buildOperatorFinalSnapshot(input.extracted, input.operatorLineQuantities);
  const linePayloads = buildDraftLineRpcPayloads(input.extracted, input.operatorLineQuantities);

  const { data: draftId, error } = await supabase.rpc("submit_sales_order_draft_for_review_atomic", {
    p_draft_id: input.draftId,
    p_expected_extraction_request_key: draftHeader.extraction_request_key,
    p_operator_final_snapshot: operatorFinal as unknown as Json,
    p_readiness_overall_score: input.extracted.readiness.overallScore,
    p_readiness_dimensions: input.extracted.readiness.dimensions as unknown as Json,
    p_lines: linePayloads as unknown as Json,
    p_actor_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_audit_metadata: { lineCount: linePayloads.length, operatorSync: true } as Json,
  });

  if (error) throw new Error(error.message);

  const reloaded = await fetchSalesOrderDraftById(draftId ?? input.draftId);
  if (!reloaded) throw new Error("Failed to reload submitted draft.");
  return reloaded;
}

export async function approveSalesOrderDraft(
  input: TransitionSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  const { data: draftId, error } = await supabase.rpc("approve_sales_order_draft_for_so_atomic", {
    p_draft_id: input.draftId,
    p_actor_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_review_notes: input.reviewNotes ?? null,
    p_metadata: {
      reviewNotes: input.reviewNotes ?? null,
    } as Json,
  });

  if (error) throw new Error(error.message);

  const reloaded = await fetchSalesOrderDraftById(draftId ?? input.draftId);
  if (!reloaded) throw new Error("Failed to reload approved draft.");
  return reloaded;
}

export async function rejectSalesOrderDraft(
  input: TransitionSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  if (!input.rejectionReason?.trim()) {
    throw new Error("Rejection reason is required.");
  }

  const { data: draftId, error } = await supabase.rpc("reject_sales_order_draft_atomic", {
    p_draft_id: input.draftId,
    p_actor_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_rejection_reason: input.rejectionReason.trim(),
    p_review_notes: input.reviewNotes ?? null,
    p_metadata: {
      reviewNotes: input.reviewNotes ?? null,
      rejectionReason: input.rejectionReason.trim(),
    } as Json,
  });

  if (error) throw new Error(error.message);

  const reloaded = await fetchSalesOrderDraftById(draftId ?? input.draftId);
  if (!reloaded) throw new Error("Failed to reload rejected draft.");
  return reloaded;
}

export async function updateSalesOrderDraftOperatorFinal(args: {
  draftId: string;
  extracted: ExtractedDraftOrder;
  operatorLineQuantities: Record<number, number>;
  actor: TransitionSalesOrderDraftInput["actor"];
}): Promise<SalesOrderDraftBundle> {
  const draftHeader = await fetchDraftHeaderForMutation(args.draftId);
  assertPersistedDraftExtractionMatch({
    extracted: args.extracted,
    extractionRequestKey: draftHeader.extraction_request_key,
    status: draftHeader.status,
    actionLabel: "sync operator edits",
  });

  const operatorFinal = buildOperatorFinalSnapshot(args.extracted, args.operatorLineQuantities);
  const linePayloads = buildDraftLineRpcPayloads(args.extracted, args.operatorLineQuantities);

  const { data: draftId, error } = await supabase.rpc("update_sales_order_draft_operator_final", {
    p_draft_id: args.draftId,
    p_expected_extraction_request_key: draftHeader.extraction_request_key,
    p_operator_final_snapshot: operatorFinal as unknown as Json,
    p_readiness_overall_score: args.extracted.readiness.overallScore,
    p_readiness_dimensions: args.extracted.readiness.dimensions as unknown as Json,
    p_lines: linePayloads as unknown as Json,
    p_actor_id: args.actor.id,
    p_actor_name: args.actor.name,
    p_audit_metadata: { lineCount: linePayloads.length } as Json,
  });

  if (error) throw new Error(error.message);

  const reloaded = await fetchSalesOrderDraftById(draftId ?? args.draftId);
  if (!reloaded) throw new Error("Failed to reload updated draft.");
  return reloaded;
}

async function fetchDraftHeaderForMutation(draftId: string): Promise<SalesOrderDraftRow> {
  const { data: draftRow, error } = await supabase
    .from("sales_order_drafts")
    .select("id, status, extraction_request_key")
    .eq("id", draftId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!draftRow) throw new Error("Sales order draft not found.");

  return parseDraftRow(draftRow as Database["public"]["Tables"]["sales_order_drafts"]["Row"]);
}

async function fetchSalesOrderDraftById(draftId: string): Promise<SalesOrderDraftBundle | null> {
  const { data: draftRow, error } = await supabase
    .from("sales_order_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!draftRow) return null;

  const draft = parseDraftRow(draftRow);

  const { lines, auditLog } = await fetchDraftLinesAndAudit(draftId);

  return {
    draft,
    lines,
    auditLog,
  };
}

export { fetchSalesOrderDraftById };
