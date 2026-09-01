import type { DraftOrderLocalDecision, DraftOrderLocalEdits } from "@/lib/wa-governance/draftOrderExtractionTypes";
import {
  loadDraftOrderLocalStore,
  replaceDraftOrderEditsFromServer,
} from "./operatorInboxDraftOrderLocalState";
import {
  loadPacketNotesMap,
  replacePacketNotesFromServer,
} from "./operatorInboxLocalNotes";
import {
  loadSavedViews,
  replaceSavedViewsFromServer,
} from "./operatorInboxSavedViews";
import {
  enqueueOperatorWorkspaceMutation,
  type OperatorWorkspaceMutation,
} from "./operatorInboxWorkspaceMutations";
import type { WorkspaceServerCorrection, WorkspaceServerSnapshot } from "./operatorInboxWorkspaceServer";

type PendingIndex = {
  deletedViews: Set<string>;
  savedViews: Set<string>;
  deletedNotes: Set<string>;
  upsertNotes: Set<string>;
  correctionFields: Set<string>;
};

type ReconciliationState = {
  queueError: string | null;
};

function pendingIndex(pending: OperatorWorkspaceMutation[]): PendingIndex {
  const result: PendingIndex = {
    deletedViews: new Set(),
    savedViews: new Set(),
    deletedNotes: new Set(),
    upsertNotes: new Set(),
    correctionFields: new Set(),
  };
  for (const item of pending) {
    if (item.kind === "DELETE_VIEW") result.deletedViews.add(item.viewId);
    if (item.kind === "SAVE_VIEW") result.savedViews.add(item.viewId);
    if (item.kind === "DELETE_NOTE") result.deletedNotes.add(item.packetId);
    if (item.kind === "UPSERT_NOTE") result.upsertNotes.add(item.packetId);
    if (item.kind === "RECORD_CORRECTION") result.correctionFields.add(`${item.packetId}:${item.field}`);
  }
  return result;
}

function enqueueMigrationMutation(
  input: Parameters<typeof enqueueOperatorWorkspaceMutation>[0],
  state: ReconciliationState,
): void {
  try {
    enqueueOperatorWorkspaceMutation(input);
  } catch (caught) {
    if (caught instanceof Error && caught.message.startsWith("WA_OPERATOR_WORKSPACE_QUEUE_FULL:")) {
      state.queueError ??= caught.message;
      return;
    }
    throw caught;
  }
}

function reconcileSavedViews(
  snapshot: WorkspaceServerSnapshot,
  pending: PendingIndex,
  state: ReconciliationState,
): void {
  const server = snapshot.savedViews.filter((view) => !pending.deletedViews.has(view.id));
  const serverIds = new Set(server.map((view) => view.id));
  const localOnly = loadSavedViews().filter(
    (view) => !serverIds.has(view.id) && !pending.deletedViews.has(view.id),
  );
  replaceSavedViewsFromServer([...server, ...localOnly].slice(0, 32));
  for (const view of localOnly) {
    if (pending.savedViews.has(view.id)) continue;
    enqueueMigrationMutation({
      kind: "SAVE_VIEW",
      viewId: view.id,
      name: view.name,
      snapshot: view.snapshot as unknown as Record<string, unknown>,
    }, state);
  }
}

function reconcilePacketNotes(
  snapshot: WorkspaceServerSnapshot,
  pending: PendingIndex,
  state: ReconciliationState,
): void {
  const merged = new Map(
    Object.entries(snapshot.packetNotes).filter(([packetId]) => !pending.deletedNotes.has(packetId)),
  );

  for (const [packetId, note] of Object.entries(loadPacketNotesMap())) {
    if (pending.deletedNotes.has(packetId)) continue;
    if (pending.upsertNotes.has(packetId)) {
      merged.set(packetId, note);
      continue;
    }
    if (merged.has(packetId)) continue;
    merged.set(packetId, note);
    enqueueMigrationMutation({ kind: "UPSERT_NOTE", packetId, text: note.text }, state);
  }
  replacePacketNotesFromServer(Object.fromEntries(merged));
}

function emptyDraft(updatedAt: string): DraftOrderLocalEdits {
  return { lineQuantities: {}, decision: "pending", updatedAt };
}

function isDecision(value: unknown): value is DraftOrderLocalDecision {
  return value === "pending" || value === "approved" || value === "rejected";
}

function applyServerCorrection(target: DraftOrderLocalEdits, correction: WorkspaceServerCorrection): void {
  if (correction.field === "draft_order.decision" && isDecision(correction.value)) {
    target.decision = correction.value;
  }
  if (correction.field.startsWith("draft_order.line_quantity.")) {
    const index = Number(correction.field.slice("draft_order.line_quantity.".length));
    if (Number.isInteger(index) && index >= 0 && typeof correction.value === "number" && Number.isFinite(correction.value)) {
      target.lineQuantities = { ...target.lineQuantities, [index]: correction.value };
    }
  }
  target.updatedAt = correction.createdAt;
}

function serverDrafts(
  corrections: WorkspaceServerCorrection[],
  pending: PendingIndex,
): { drafts: Map<string, DraftOrderLocalEdits>; fields: Set<string> } {
  const drafts = new Map<string, DraftOrderLocalEdits>();
  const fields = new Set<string>();
  const orderedCorrections = [...corrections].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  for (const correction of orderedCorrections) {
    const key = `${correction.packetId}:${correction.field}`;
    fields.add(key);
    const draft = drafts.get(correction.packetId) ?? emptyDraft(new Date(0).toISOString());
    if (!pending.correctionFields.has(key)) applyServerCorrection(draft, correction);
    drafts.set(correction.packetId, draft);
  }
  return { drafts, fields };
}

function migrateLocalQuantities(
  packetId: string,
  local: DraftOrderLocalEdits,
  merged: DraftOrderLocalEdits,
  serverFields: Set<string>,
  pending: PendingIndex,
  state: ReconciliationState,
): void {
  for (const [indexText, quantity] of Object.entries(local.lineQuantities)) {
    const field = `draft_order.line_quantity.${indexText}`;
    const key = `${packetId}:${field}`;
    if (serverFields.has(key) && !pending.correctionFields.has(key)) continue;
    merged.lineQuantities = { ...merged.lineQuantities, [Number(indexText)]: quantity };
    if (serverFields.has(key) || pending.correctionFields.has(key)) continue;
    enqueueMigrationMutation({
      kind: "RECORD_CORRECTION",
      packetId,
      field,
      value: quantity,
      priorValue: null,
      reason: "Migrated browser draft quantity into governed operator workspace",
    }, state);
  }
}

function migrateLocalDecision(
  packetId: string,
  local: DraftOrderLocalEdits,
  merged: DraftOrderLocalEdits,
  serverFields: Set<string>,
  pending: PendingIndex,
  state: ReconciliationState,
): void {
  if (local.decision === "pending") return;
  const field = "draft_order.decision";
  const key = `${packetId}:${field}`;
  if (serverFields.has(key) && !pending.correctionFields.has(key)) return;
  merged.decision = local.decision;
  if (serverFields.has(key) || pending.correctionFields.has(key)) return;
  enqueueMigrationMutation({
    kind: "RECORD_CORRECTION",
    packetId,
    field,
    value: local.decision,
    priorValue: "pending",
    reason: "Migrated browser draft decision into governed operator workspace",
  }, state);
}

function reconcileDraftCorrections(
  snapshot: WorkspaceServerSnapshot,
  pending: PendingIndex,
  state: ReconciliationState,
): void {
  const { drafts, fields } = serverDrafts(snapshot.corrections, pending);
  for (const [packetId, local] of Object.entries(loadDraftOrderLocalStore())) {
    const merged = drafts.get(packetId) ?? emptyDraft(local.updatedAt);
    migrateLocalQuantities(packetId, local, merged, fields, pending, state);
    migrateLocalDecision(packetId, local, merged, fields, pending, state);
    drafts.set(packetId, merged);
  }
  for (const [packetId, edits] of drafts) replaceDraftOrderEditsFromServer(packetId, edits);
}

export function reconcileOperatorWorkspaceCaches(
  snapshot: WorkspaceServerSnapshot,
  pendingMutations: OperatorWorkspaceMutation[],
): string | null {
  const pending = pendingIndex(pendingMutations);
  const state: ReconciliationState = { queueError: null };
  reconcileSavedViews(snapshot, pending, state);
  reconcilePacketNotes(snapshot, pending, state);
  reconcileDraftCorrections(snapshot, pending, state);
  return state.queueError;
}
