import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
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

type WorkspaceSavedViewRow = {
  id: string;
  owner_user_id: string;
  view_key: string;
  view_label: string;
  filter_config: Json;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

type WorkspacePacketNoteRow = {
  id: string;
  packet_id: string;
  actor_id: string;
  note_body: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

type WorkspaceCorrectionRow = {
  id: string;
  case_id: string;
  packet_id: string;
  correction_field: string;
  prior_value: Json | null;
  corrected_value: Json;
  correction_reason: string | null;
  idempotency_key: string;
  actor_id: string;
  supersedes_correction_id: string | null;
  superseded_by_correction_id: string | null;
  is_active: boolean;
  created_at: string;
};

type WorkspaceCommunicationCaseRow = {
  id: string;
  packet_id: string;
};

type WorkspaceTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * Exact additive Core contract for PRs #168/#172. The repository-generated
 * Database baseline predates these relations, so intersect it rather than
 * widening the client to an untyped SupabaseClient escape hatch.
 */
type OperatorWorkspaceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      whatsapp_operator_saved_views: WorkspaceTable<WorkspaceSavedViewRow>;
      whatsapp_operator_packet_notes: WorkspaceTable<WorkspacePacketNoteRow>;
      whatsapp_operator_case_corrections: WorkspaceTable<WorkspaceCorrectionRow>;
      whatsapp_communication_cases: WorkspaceTable<WorkspaceCommunicationCaseRow>;
    };
    Functions: Database["public"]["Functions"] & {
      upsert_whatsapp_operator_note: {
        Args: { p_packet_id: string; p_note_body: string; p_idempotency_key: string };
        Returns: WorkspacePacketNoteRow;
      };
      delete_whatsapp_operator_note: {
        Args: { p_packet_id: string; p_idempotency_key: string };
        Returns: boolean;
      };
      save_whatsapp_operator_view: {
        Args: { p_view_key: string; p_view_label: string; p_filter_config: Json; p_idempotency_key: string };
        Returns: WorkspaceSavedViewRow;
      };
      delete_whatsapp_operator_view: {
        Args: { p_view_key: string; p_idempotency_key: string };
        Returns: boolean;
      };
      record_whatsapp_operator_correction: {
        Args: {
          p_case_id: string;
          p_packet_id: string;
          p_correction_field: string;
          p_corrected_value: Json;
          p_idempotency_key: string;
          p_prior_value?: Json | null;
          p_correction_reason?: string | null;
        };
        Returns: WorkspaceCorrectionRow;
      };
    };
  };
};

type WorkspaceClient = SupabaseClient<OperatorWorkspaceDatabase>;
const workspaceClient = supabase as unknown as WorkspaceClient;

function jsonValue(value: unknown): Json {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as Json;
}

function savedViewSnapshot(value: Json): OperatorInboxSavedViewSnapshot {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
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

function parseSavedViews(value: WorkspaceSavedViewRow[] | null): OperatorInboxSavedView[] {
  return (value ?? []).map((row) => ({
    id: row.view_key,
    name: row.view_label,
    createdAt: row.created_at,
    snapshot: savedViewSnapshot(row.filter_config),
  }));
}

function parsePacketNotes(value: WorkspacePacketNoteRow[] | null): WorkspaceServerSnapshot["packetNotes"] {
  const result = new Map<string, { text: string; updatedAt: string }>();
  for (const row of value ?? []) {
    if (!row.packet_id || !row.note_body.trim()) continue;
    result.set(row.packet_id, { text: row.note_body, updatedAt: row.updated_at });
  }
  return Object.fromEntries(result);
}

function parseCorrections(value: WorkspaceCorrectionRow[] | null): WorkspaceServerCorrection[] {
  return (value ?? [])
    .filter((row) => row.correction_field.startsWith("draft_order."))
    .map((row) => ({
      packetId: row.packet_id,
      field: row.correction_field,
      value: row.corrected_value,
      createdAt: row.created_at,
    }));
}

export async function fetchOperatorWorkspaceServerSnapshot(signal?: AbortSignal): Promise<WorkspaceServerSnapshot> {
  const client = workspaceClient;
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw new Error(authError.message);
  const actorId = authData.user?.id;
  if (!actorId) throw new Error("WA_OPERATOR_AUTH_REQUIRED");

  let viewsQuery = client.from("whatsapp_operator_saved_views")
    .select("id,owner_user_id,view_key,view_label,filter_config,idempotency_key,created_at,updated_at")
    .eq("owner_user_id", actorId);
  let notesQuery = client.from("whatsapp_operator_packet_notes")
    .select("id,packet_id,actor_id,note_body,idempotency_key,created_at,updated_at")
    .eq("actor_id", actorId);
  let correctionsQuery = client.from("whatsapp_operator_case_corrections")
    .select("id,case_id,packet_id,correction_field,prior_value,corrected_value,correction_reason,idempotency_key,actor_id,supersedes_correction_id,superseded_by_correction_id,is_active,created_at")
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

async function caseIdForPacket(client: WorkspaceClient, packetId: string): Promise<string> {
  const { data, error } = await client
    .from("whatsapp_communication_cases")
    .select("id,packet_id")
    .eq("packet_id", packetId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("WA_OPERATOR_CASE_NOT_AVAILABLE");
  return data.id;
}

function throwRpcError(name: string, error: { message?: string } | null): void {
  if (error) throw new Error(error.message || `${name.toUpperCase()}_FAILED`);
}

export async function persistOperatorWorkspaceMutation(mutation: OperatorWorkspaceMutation): Promise<void> {
  const client = workspaceClient;
  const idempotencyKey = operatorWorkspaceMutationIdempotencyKey(mutation);

  if (mutation.kind === "UPSERT_NOTE") {
    const { error } = await client.rpc("upsert_whatsapp_operator_note", {
      p_packet_id: mutation.packetId,
      p_note_body: mutation.text,
      p_idempotency_key: idempotencyKey,
    });
    throwRpcError("upsert_whatsapp_operator_note", error);
    return;
  }
  if (mutation.kind === "DELETE_NOTE") {
    const { error } = await client.rpc("delete_whatsapp_operator_note", {
      p_packet_id: mutation.packetId,
      p_idempotency_key: idempotencyKey,
    });
    throwRpcError("delete_whatsapp_operator_note", error);
    return;
  }
  if (mutation.kind === "SAVE_VIEW") {
    const { error } = await client.rpc("save_whatsapp_operator_view", {
      p_view_key: mutation.viewId,
      p_view_label: mutation.name,
      p_filter_config: jsonValue(mutation.snapshot),
      p_idempotency_key: idempotencyKey,
    });
    throwRpcError("save_whatsapp_operator_view", error);
    return;
  }
  if (mutation.kind === "DELETE_VIEW") {
    const { error } = await client.rpc("delete_whatsapp_operator_view", {
      p_view_key: mutation.viewId,
      p_idempotency_key: idempotencyKey,
    });
    throwRpcError("delete_whatsapp_operator_view", error);
    return;
  }

  const caseId = await caseIdForPacket(client, mutation.packetId);
  const { error } = await client.rpc("record_whatsapp_operator_correction", {
    p_case_id: caseId,
    p_packet_id: mutation.packetId,
    p_correction_field: mutation.field,
    p_corrected_value: jsonValue(mutation.value),
    p_idempotency_key: idempotencyKey,
    p_prior_value: jsonValue(mutation.priorValue),
    p_correction_reason: mutation.reason ?? null,
  });
  throwRpcError("record_whatsapp_operator_correction", error);
}
