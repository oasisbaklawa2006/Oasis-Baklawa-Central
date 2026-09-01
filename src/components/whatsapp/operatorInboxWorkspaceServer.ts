import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizePersistedBulkFilters } from "./operatorInboxUiPersistence";
import type { OperatorInboxSavedView, OperatorInboxSavedViewSnapshot } from "./operatorInboxSavedViews";
import {
  operatorWorkspaceMutationIdempotencyKey,
  type OperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceMutations";

export type WorkspaceServerCorrection = {
  packetId: string;
  field: string;
  value: unknown;
  createdAt: string;
};

export type WorkspaceServerSnapshot = {
  savedViews: OperatorInboxSavedView[];
  packetNotes: Record<string, { text: string; updatedAt: string }>;
  corrections: WorkspaceServerCorrection[];
};

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcInvoker = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function rpcInvoker(client: SupabaseClient): RpcInvoker {
  return client.rpc.bind(client) as unknown as RpcInvoker;
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function savedViewSnapshot(value: unknown): OperatorInboxSavedViewSnapshot {
  const row = object(value);
  const pinnedIds = Array.isArray(row.pinnedIds)
    ? row.pinnedIds.filter((item): item is string => typeof item === "string")
    : [];
  return {
    filterQuery: typeof row.filterQuery === "string" ? row.filterQuery : "",
    unansweredOnly: row.unansweredOnly === true,
    pinnedIds,
    bulkFilters: normalizePersistedBulkFilters(row.bulkFilters as OperatorInboxSavedViewSnapshot["bulkFilters"] | undefined),
    compactMode: row.compactMode === true,
    showObservabilityStrip: typeof row.showObservabilityStrip === "boolean" ? row.showObservabilityStrip : true,
    showAiPreviewPanel: typeof row.showAiPreviewPanel === "boolean" ? row.showAiPreviewPanel : true,
  };
}

function parseSavedViews(value: unknown): OperatorInboxSavedView[] {
  const result: OperatorInboxSavedView[] = [];
  for (const row of rows(value)) {
    const id = text(row.view_key);
    const name = text(row.view_label);
    if (!id || !name) continue;
    result.push({
      id,
      name,
      createdAt: text(row.created_at) ?? new Date(0).toISOString(),
      snapshot: savedViewSnapshot(row.filter_config),
    });
  }
  return result;
}

function parsePacketNotes(value: unknown): WorkspaceServerSnapshot["packetNotes"] {
  const result = new Map<string, { text: string; updatedAt: string }>();
  for (const row of rows(value)) {
    const packetId = text(row.packet_id);
    const noteBody = text(row.note_body);
    if (!packetId || !noteBody) continue;
    result.set(packetId, {
      text: noteBody,
      updatedAt: text(row.updated_at) ?? new Date(0).toISOString(),
    });
  }
  return Object.fromEntries(result);
}

function parseCorrections(value: unknown): WorkspaceServerCorrection[] {
  const result: WorkspaceServerCorrection[] = [];
  for (const row of rows(value)) {
    const packetId = text(row.packet_id);
    const field = text(row.correction_field);
    if (!packetId || !field || !field.startsWith("draft_order.")) continue;
    result.push({
      packetId,
      field,
      value: row.corrected_value,
      createdAt: text(row.created_at) ?? new Date(0).toISOString(),
    });
  }
  return result;
}

export async function fetchOperatorWorkspaceServerSnapshot(signal?: AbortSignal): Promise<WorkspaceServerSnapshot> {
  const client = db();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw new Error(authError.message);
  const actorId = authData.user?.id;
  if (!actorId) throw new Error("WA_OPERATOR_AUTH_REQUIRED");

  let viewsQuery = client.from("whatsapp_operator_saved_views")
    .select("view_key,view_label,filter_config,created_at,updated_at")
    .eq("owner_user_id", actorId);
  let notesQuery = client.from("whatsapp_operator_packet_notes")
    .select("packet_id,actor_id,note_body,updated_at")
    .eq("actor_id", actorId);
  let correctionsQuery = client.from("whatsapp_operator_case_corrections")
    .select("packet_id,correction_field,corrected_value,created_at,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (signal) {
    viewsQuery = viewsQuery.abortSignal(signal);
    notesQuery = notesQuery.abortSignal(signal);
    correctionsQuery = correctionsQuery.abortSignal(signal);
  }

  const [viewsResult, notesResult, correctionsResult] = await Promise.all([
    viewsQuery,
    notesQuery,
    correctionsQuery,
  ]);

  if (viewsResult.error) throw new Error(viewsResult.error.message);
  if (notesResult.error) throw new Error(notesResult.error.message);
  if (correctionsResult.error) throw new Error(correctionsResult.error.message);

  return {
    savedViews: parseSavedViews(viewsResult.data),
    packetNotes: parsePacketNotes(notesResult.data),
    corrections: parseCorrections(correctionsResult.data),
  };
}

async function caseIdForPacket(client: SupabaseClient, packetId: string): Promise<string> {
  const { data, error } = await client
    .from("whatsapp_communication_cases")
    .select("id")
    .eq("packet_id", packetId)
    .limit(1);
  if (error) throw new Error(error.message);
  const caseId = text(rows(data)[0]?.id);
  if (!caseId) throw new Error("WA_OPERATOR_CASE_NOT_AVAILABLE");
  return caseId;
}

async function callRpc(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<void> {
  try {
    const result = await rpcInvoker(client)(name, args);
    if (result.error) throw new Error(result.error.message || `${name.toUpperCase()}_FAILED`);
  } catch (caught) {
    throw caught instanceof Error ? caught : new Error(`${name.toUpperCase()}_FAILED`);
  }
}

export async function persistOperatorWorkspaceMutation(mutation: OperatorWorkspaceMutation): Promise<void> {
  const client = db();
  const idempotencyKey = operatorWorkspaceMutationIdempotencyKey(mutation);

  if (mutation.kind === "UPSERT_NOTE") {
    return callRpc(client, "upsert_whatsapp_operator_note", {
      p_packet_id: mutation.packetId,
      p_note_body: mutation.text,
      p_idempotency_key: idempotencyKey,
    });
  }
  if (mutation.kind === "DELETE_NOTE") {
    return callRpc(client, "delete_whatsapp_operator_note", {
      p_packet_id: mutation.packetId,
      p_idempotency_key: idempotencyKey,
    });
  }
  if (mutation.kind === "SAVE_VIEW") {
    return callRpc(client, "save_whatsapp_operator_view", {
      p_view_key: mutation.viewId,
      p_view_label: mutation.name,
      p_filter_config: mutation.snapshot,
      p_idempotency_key: idempotencyKey,
    });
  }
  if (mutation.kind === "DELETE_VIEW") {
    return callRpc(client, "delete_whatsapp_operator_view", {
      p_view_key: mutation.viewId,
      p_idempotency_key: idempotencyKey,
    });
  }

  const caseId = await caseIdForPacket(client, mutation.packetId);
  await callRpc(client, "record_whatsapp_operator_correction", {
    p_case_id: caseId,
    p_packet_id: mutation.packetId,
    p_correction_field: mutation.field,
    p_corrected_value: mutation.value,
    p_idempotency_key: idempotencyKey,
    p_prior_value: mutation.priorValue ?? null,
    p_correction_reason: mutation.reason ?? null,
  });
}
