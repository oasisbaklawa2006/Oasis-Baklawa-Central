import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import { buildOperatorFinalSnapshot, buildDraftHeaderInsert, buildDraftLineInserts } from "./mapExtractedDraft";
import { canTransitionToApproved } from "./readinessValidation";
import type {
  CreateSalesOrderDraftInput,
  SalesOrderDraftAuditEntry,
  SalesOrderDraftBundle,
  SalesOrderDraftRow,
  SalesOrderDraftStatus,
  TransitionSalesOrderDraftInput,
} from "./types";
import { getNextStatus } from "./workflowTransitions";

type DraftInsert = Database["public"]["Tables"]["sales_order_drafts"]["Insert"];
type DraftLineInsert = Database["public"]["Tables"]["sales_order_draft_lines"]["Insert"];
type DraftUpdate = Database["public"]["Tables"]["sales_order_drafts"]["Update"];
type DraftLineUpdate = Database["public"]["Tables"]["sales_order_draft_lines"]["Update"];

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

async function appendAuditEntry(args: {
  draftId: string;
  action: SalesOrderDraftAuditEntry["action"];
  fromStatus: SalesOrderDraftStatus | null;
  toStatus: SalesOrderDraftStatus | null;
  actorId: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("sales_order_draft_audit_log").insert({
    draft_id: args.draftId,
    action: args.action,
    from_status: args.fromStatus,
    to_status: args.toStatus,
    actor_id: args.actorId,
    actor_name: args.actorName,
    metadata: (args.metadata ?? {}) as Json,
  });
  if (error) throw new Error(error.message);
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
  if (existing && existing.draft.status !== "REJECTED") {
    throw new Error(
      `Active sales order draft already exists for packet (${existing.draft.status}).`,
    );
  }

  const header = buildDraftHeaderInsert(input) as DraftInsert;
  const { data: inserted, error: insertError } = await supabase
    .from("sales_order_drafts")
    .insert(header)
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  const draft = parseDraftRow(inserted);

  const lineRows = buildDraftLineInserts(
    draft.id,
    input.extracted,
    input.operatorLineQuantities,
  );

  if (lineRows.length > 0) {
    const { error: linesError } = await supabase
      .from("sales_order_draft_lines")
      .insert(lineRows as DraftLineInsert[]);
    if (linesError) throw new Error(linesError.message);
  }

  await appendAuditEntry({
    draftId: draft.id,
    action: "CREATE",
    fromStatus: null,
    toStatus: "AI_DRAFT",
    actorId: input.actor.id,
    actorName: input.actor.name,
    metadata: {
      packetId: input.extracted.packetId,
      extractionRequestKey: input.extracted.extractionRequestKey,
      readinessScore: input.extracted.readiness.overallScore,
    },
  });

  const bundle = await fetchSalesOrderDraftByPacket(input.extracted.packetId);
  if (!bundle) throw new Error("Failed to reload created sales order draft.");
  return bundle;
}

export async function submitSalesOrderDraftForReview(
  input: TransitionSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  return transitionDraft(input, "SUBMIT_REVIEW", "SUBMIT_REVIEW");
}

export async function approveSalesOrderDraft(
  input: TransitionSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  const bundle = await fetchSalesOrderDraftById(input.draftId);
  if (!bundle) throw new Error("Sales order draft not found.");

  const validation = canTransitionToApproved(bundle.draft.readiness_dimensions);
  if (!validation.valid) {
    throw new Error(validation.messages.join(" "));
  }

  return transitionDraft(input, "APPROVE", "APPROVE");
}

export async function rejectSalesOrderDraft(
  input: TransitionSalesOrderDraftInput,
): Promise<SalesOrderDraftBundle> {
  if (!input.rejectionReason?.trim()) {
    throw new Error("Rejection reason is required.");
  }
  return transitionDraft(input, "REJECT", "REJECT");
}

export async function updateSalesOrderDraftOperatorFinal(args: {
  draftId: string;
  extracted: ExtractedDraftOrder;
  operatorLineQuantities: Record<number, number>;
  actor: TransitionSalesOrderDraftInput["actor"];
}): Promise<SalesOrderDraftBundle> {
  const bundle = await fetchSalesOrderDraftById(args.draftId);
  if (!bundle) throw new Error("Sales order draft not found.");
  if (bundle.draft.status === "APPROVED_FOR_SO" || bundle.draft.status === "REJECTED") {
    throw new Error(`Cannot update operator final in terminal status ${bundle.draft.status}.`);
  }

  const operatorFinal = buildOperatorFinalSnapshot(args.extracted, args.operatorLineQuantities);
  const lineUpdates = buildDraftLineInserts(args.draftId, args.extracted, args.operatorLineQuantities);

  const { error: headerError } = await supabase
    .from("sales_order_drafts")
    .update({
      operator_final_snapshot: operatorFinal as unknown as Json,
      readiness_overall_score: args.extracted.readiness.overallScore,
      readiness_dimensions: args.extracted.readiness.dimensions as unknown as Json,
      updated_by: args.actor.id,
    } satisfies DraftUpdate)
    .eq("id", args.draftId);

  if (headerError) throw new Error(headerError.message);

  for (const line of lineUpdates) {
    const { error } = await supabase
      .from("sales_order_draft_lines")
      .update({
        operator_quantity: line.operator_quantity,
        operator_line_snapshot: line.operator_line_snapshot as unknown as Json,
      } satisfies DraftLineUpdate)
      .eq("draft_id", args.draftId)
      .eq("line_index", line.line_index);
    if (error) throw new Error(error.message);
  }

  await appendAuditEntry({
    draftId: args.draftId,
    action: "UPDATE_OPERATOR_FINAL",
    fromStatus: bundle.draft.status,
    toStatus: bundle.draft.status,
    actorId: args.actor.id,
    actorName: args.actor.name,
    metadata: { lineCount: lineUpdates.length },
  });

  const reloaded = await fetchSalesOrderDraftById(args.draftId);
  if (!reloaded) throw new Error("Failed to reload updated draft.");
  return reloaded;
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

async function transitionDraft(
  input: TransitionSalesOrderDraftInput,
  transition: "SUBMIT_REVIEW" | "APPROVE" | "REJECT",
  auditAction: SalesOrderDraftAuditEntry["action"],
): Promise<SalesOrderDraftBundle> {
  const bundle = await fetchSalesOrderDraftById(input.draftId);
  if (!bundle) throw new Error("Sales order draft not found.");

  const expectedStatus = bundle.draft.status;
  const nextStatus = getNextStatus(expectedStatus, transition);
  if (!nextStatus) {
    throw new Error(`Transition ${transition} not allowed from ${expectedStatus}.`);
  }

  const { error } = await supabase.rpc("transition_sales_order_draft_status", {
    p_draft_id: input.draftId,
    p_expected_status: expectedStatus,
    p_next_status: nextStatus,
    p_action: auditAction,
    p_actor_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_review_notes: input.reviewNotes ?? null,
    p_rejection_reason: input.rejectionReason?.trim() ?? null,
    p_approver_id: transition === "APPROVE" ? input.actor.id : null,
    p_approver_name: transition === "APPROVE" ? input.actor.name : null,
    p_metadata: {
      reviewNotes: input.reviewNotes ?? null,
      rejectionReason: input.rejectionReason ?? null,
    } as Json,
  });

  if (error) throw new Error(error.message);

  const reloaded = await fetchSalesOrderDraftById(input.draftId);
  if (!reloaded) throw new Error("Failed to reload transitioned draft.");
  return reloaded;
}

export { fetchSalesOrderDraftById };
