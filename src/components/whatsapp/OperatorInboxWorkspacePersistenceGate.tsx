import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizePersistedBulkFilters } from "./operatorInboxUiPersistence";
import {
  loadSavedViews,
  replaceSavedViewsFromServer,
  type OperatorInboxSavedView,
  type OperatorInboxSavedViewSnapshot,
} from "./operatorInboxSavedViews";
import {
  loadPacketNotesMap,
  replacePacketNotesFromServer,
  type OperatorInboxPacketNotesMap,
} from "./operatorInboxLocalNotes";
import {
  loadDraftOrderLocalStore,
  replaceDraftOrderEditsFromServer,
} from "./operatorInboxDraftOrderLocalState";
import type { DraftOrderLocalDecision, DraftOrderLocalEdits } from "@/lib/wa-governance/draftOrderExtractionTypes";
import {
  OPERATOR_WORKSPACE_MUTATION_EVENT,
  enqueueOperatorWorkspaceMutation,
  loadPendingOperatorWorkspaceMutations,
  operatorWorkspaceMutationIdempotencyKey,
  removePendingOperatorWorkspaceMutation,
  type OperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceMutations";

const RETRY_MS = 30_000;

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcInvoker = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

function client(): SupabaseClient {
  // Core owns these forward-only tables/RPCs; generated Central types can lag safely.
  return supabase as unknown as SupabaseClient;
}

function rpcInvoker(db: SupabaseClient): RpcInvoker {
  return db.rpc.bind(db) as unknown as RpcInvoker;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function savedViewSnapshot(value: unknown): OperatorInboxSavedViewSnapshot {
  const row = objectValue(value);
  return {
    filterQuery: typeof row.filterQuery === "string" ? row.filterQuery : "",
    unansweredOnly: row.unansweredOnly === true,
    pinnedIds: Array.isArray(row.pinnedIds)
      ? row.pinnedIds.filter((item): item is string => typeof item === "string")
      : [],
    bulkFilters: normalizePersistedBulkFilters(row.bulkFilters as OperatorInboxSavedViewSnapshot["bulkFilters"] | undefined),
    compactMode: row.compactMode === true,
    showObservabilityStrip: row.showObservabilityStrip === true,
    showAiPreviewPanel: row.showAiPreviewPanel === true,
  };
}

function serverSavedViews(value: unknown): OperatorInboxSavedView[] {
  return rows(value).flatMap((row) => {
    const id = stringValue(row.view_key);
    const name = stringValue(row.view_label);
    if (!id || !name) return [];
    return [{
      id,
      name,
      createdAt: stringValue(row.created_at) ?? new Date(0).toISOString(),
      snapshot: savedViewSnapshot(row.filter_config),
    }];
  });
}

function isDecision(value: unknown): value is DraftOrderLocalDecision {
  return value === "pending" || value === "approved" || value === "rejected";
}

async function invokeMutation(db: SupabaseClient, mutation: OperatorWorkspaceMutation): Promise<void> {
  const key = operatorWorkspaceMutationIdempotencyKey(mutation);
  const rpc = rpcInvoker(db);
  let result: RpcResult;

  switch (mutation.kind) {
    case "UPSERT_NOTE":
      result = await rpc("upsert_whatsapp_operator_note", {
        p_packet_id: mutation.packetId,
        p_note_body: mutation.text,
        p_idempotency_key: key,
      });
      break;
    case "DELETE_NOTE":
      result = await rpc("delete_whatsapp_operator_note", {
        p_packet_id: mutation.packetId,
        p_idempotency_key: key,
      });
      break;
    case "SAVE_VIEW":
      result = await rpc("save_whatsapp_operator_view", {
        p_view_key: mutation.viewId,
        p_view_label: mutation.name,
        p_filter_config: mutation.snapshot,
        p_idempotency_key: key,
      });
      break;
    case "DELETE_VIEW":
      result = await rpc("delete_whatsapp_operator_view", {
        p_view_key: mutation.viewId,
        p_idempotency_key: key,
      });
      break;
    case "RECORD_CORRECTION": {
      const { data: caseRows, error: caseError } = await db
        .from("whatsapp_communication_cases")
        .select("id")
        .eq("packet_id", mutation.packetId)
        .limit(1);
      if (caseError) throw new Error(caseError.message);
      const caseId = stringValue(rows(caseRows)[0]?.id);
      if (!caseId) throw new Error("WA_OPERATOR_CASE_NOT_AVAILABLE");
      result = await rpc("record_whatsapp_operator_correction", {
        p_case_id: caseId,
        p_packet_id: mutation.packetId,
        p_correction_field: mutation.field,
        p_corrected_value: mutation.value,
        p_idempotency_key: key,
        p_prior_value: mutation.priorValue ?? null,
        p_correction_reason: mutation.reason ?? null,
      });
      break;
    }
  }

  if (result.error) throw new Error(result.error.message || `WA_OPERATOR_${mutation.kind}_FAILED`);
}

export function OperatorInboxWorkspacePersistenceGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const db = client();
    try {
      for (const mutation of loadPendingOperatorWorkspaceMutations()) {
        try {
          await invokeMutation(db, mutation);
          removePendingOperatorWorkspaceMutation(mutation.id);
          setSyncError(null);
        } catch (caught) {
          setSyncError(caught instanceof Error ? caught.message : "Operator workspace sync failed");
          break;
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const db = client();

    const hydrate = async () => {
      try {
        const { data: authData, error: authError } = await db.auth.getUser();
        if (authError) throw new Error(authError.message);
        const actorId = authData.user?.id;
        if (!actorId) throw new Error("WA_OPERATOR_AUTH_REQUIRED");

        const pending = loadPendingOperatorWorkspaceMutations();
        const pendingDeletedViews = new Set(
          pending.filter((item) => item.kind === "DELETE_VIEW").map((item) => item.viewId),
        );
        const pendingDeletedNotes = new Set(
          pending.filter((item) => item.kind === "DELETE_NOTE").map((item) => item.packetId),
        );
        const pendingCorrectionFields = new Set(
          pending
            .filter((item) => item.kind === "RECORD_CORRECTION")
            .map((item) => `${item.packetId}:${item.field}`),
        );

        const [viewsResult, notesResult, correctionsResult] = await Promise.all([
          db.from("whatsapp_operator_saved_views")
            .select("view_key,view_label,filter_config,created_at,updated_at")
            .eq("owner_user_id", actorId),
          db.from("whatsapp_operator_packet_notes")
            .select("packet_id,actor_id,note_body,updated_at")
            .eq("actor_id", actorId),
          db.from("whatsapp_operator_case_corrections")
            .select("packet_id,correction_field,corrected_value,created_at,is_active")
            .eq("is_active", true),
        ]);

        if (viewsResult.error) throw new Error(viewsResult.error.message);
        if (notesResult.error) throw new Error(notesResult.error.message);
        if (correctionsResult.error) throw new Error(correctionsResult.error.message);
        if (cancelled) return;

        const localViews = loadSavedViews();
        const authoritativeViews = serverSavedViews(viewsResult.data)
          .filter((view) => !pendingDeletedViews.has(view.id));
        const serverViewIds = new Set(authoritativeViews.map((view) => view.id));
        const localOnlyViews = localViews.filter((view) => !serverViewIds.has(view.id) && !pendingDeletedViews.has(view.id));
        replaceSavedViewsFromServer([...authoritativeViews, ...localOnlyViews].slice(0, 32));
        for (const view of localOnlyViews) {
          enqueueOperatorWorkspaceMutation({
            kind: "SAVE_VIEW",
            viewId: view.id,
            name: view.name,
            snapshot: view.snapshot as unknown as Record<string, unknown>,
          });
        }

        const localNotes = loadPacketNotesMap();
        const authoritativeNotes: OperatorInboxPacketNotesMap = {};
        for (const row of rows(notesResult.data)) {
          const packetId = stringValue(row.packet_id);
          const text = stringValue(row.note_body);
          if (!packetId || !text || pendingDeletedNotes.has(packetId)) continue;
          authoritativeNotes[packetId] = {
            text,
            updatedAt: stringValue(row.updated_at) ?? new Date(0).toISOString(),
          };
        }
        for (const [packetId, note] of Object.entries(localNotes)) {
          if (pendingDeletedNotes.has(packetId) || authoritativeNotes[packetId]) continue;
          authoritativeNotes[packetId] = note;
          enqueueOperatorWorkspaceMutation({ kind: "UPSERT_NOTE", packetId, text: note.text });
        }
        replacePacketNotesFromServer(authoritativeNotes);

        const localDrafts = loadDraftOrderLocalStore();
        const correctionsByPacket = new Map<string, DraftOrderLocalEdits>();
        const serverFields = new Set<string>();
        for (const row of rows(correctionsResult.data)) {
          const packetId = stringValue(row.packet_id);
          const field = stringValue(row.correction_field);
          if (!packetId || !field || !field.startsWith("draft_order.")) continue;
          serverFields.add(`${packetId}:${field}`);
          const current = correctionsByPacket.get(packetId) ?? {
            lineQuantities: {},
            decision: "pending" as DraftOrderLocalDecision,
            updatedAt: new Date(0).toISOString(),
          };
          if (!pendingCorrectionFields.has(`${packetId}:${field}`)) {
            if (field === "draft_order.decision" && isDecision(row.corrected_value)) {
              current.decision = row.corrected_value;
            } else if (field.startsWith("draft_order.line_quantity.")) {
              const index = Number(field.slice("draft_order.line_quantity.".length));
              if (Number.isInteger(index) && typeof row.corrected_value === "number" && Number.isFinite(row.corrected_value)) {
                current.lineQuantities[index] = row.corrected_value;
              }
            }
          }
          current.updatedAt = stringValue(row.created_at) ?? current.updatedAt;
          correctionsByPacket.set(packetId, current);
        }

        for (const [packetId, local] of Object.entries(localDrafts)) {
          const merged = correctionsByPacket.get(packetId) ?? {
            lineQuantities: {},
            decision: "pending" as DraftOrderLocalDecision,
            updatedAt: local.updatedAt,
          };
          for (const [indexText, quantity] of Object.entries(local.lineQuantities)) {
            const field = `draft_order.line_quantity.${indexText}`;
            const fieldKey = `${packetId}:${field}`;
            if (!serverFields.has(fieldKey) || pendingCorrectionFields.has(fieldKey)) {
              merged.lineQuantities[Number(indexText)] = quantity;
              if (!pendingCorrectionFields.has(fieldKey) && !serverFields.has(fieldKey)) {
                enqueueOperatorWorkspaceMutation({
                  kind: "RECORD_CORRECTION",
                  packetId,
                  field,
                  value: quantity,
                  priorValue: null,
                  reason: "Migrated browser draft quantity into governed operator workspace",
                });
              }
            }
          }
          const decisionField = `${packetId}:draft_order.decision`;
          if ((!serverFields.has(decisionField) || pendingCorrectionFields.has(decisionField)) && local.decision !== "pending") {
            merged.decision = local.decision;
            if (!pendingCorrectionFields.has(decisionField) && !serverFields.has(decisionField)) {
              enqueueOperatorWorkspaceMutation({
                kind: "RECORD_CORRECTION",
                packetId,
                field: "draft_order.decision",
                value: local.decision,
                priorValue: "pending",
                reason: "Migrated browser draft decision into governed operator workspace",
              });
            }
          }
          correctionsByPacket.set(packetId, merged);
        }

        for (const [packetId, edits] of correctionsByPacket) {
          replaceDraftOrderEditsFromServer(packetId, edits);
        }

        setSyncError(null);
      } catch (caught) {
        if (!cancelled) setSyncError(caught instanceof Error ? caught.message : "Operator workspace hydration failed");
      } finally {
        if (!cancelled) {
          setReady(true);
          void processQueue();
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [processQueue]);

  useEffect(() => {
    const onMutation = () => void processQueue();
    const onOnline = () => void processQueue();
    window.addEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, onMutation);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void processQueue(), RETRY_MS);
    return () => {
      window.removeEventListener(OPERATOR_WORKSPACE_MUTATION_EVENT, onMutation);
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [processQueue]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50" role="status">
        <p className="text-sm text-gray-600">Loading governed WhatsApp operator workspace…</p>
      </div>
    );
  }

  return (
    <>
      {syncError ? (
        <div className="fixed inset-x-0 top-0 z-[100] border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-950" role="status">
          Operator workspace changes are queued for governed retry: {syncError}
        </div>
      ) : null}
      {children}
    </>
  );
}
