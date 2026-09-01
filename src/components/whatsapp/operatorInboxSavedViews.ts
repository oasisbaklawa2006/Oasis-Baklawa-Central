import type { OperatorInboxBulkFilters } from "./operatorInboxBulkFilter";
import { normalizePersistedBulkFilters } from "./operatorInboxUiPersistence";
import { enqueueOperatorWorkspaceMutation } from "./operatorInboxWorkspaceMutations";

const STORAGE_KEY = "oasis_c2b2_operator_inbox_saved_views_v1";
const MAX_VIEWS = 32;

/** Serializable slice of inbox UI for named presets. Browser storage is a cache; Core is authority. */
export interface OperatorInboxSavedViewSnapshot {
  filterQuery: string;
  unansweredOnly: boolean;
  pinnedIds: string[];
  bulkFilters: OperatorInboxBulkFilters;
  compactMode: boolean;
  showObservabilityStrip: boolean;
  showAiPreviewPanel: boolean;
}

export interface OperatorInboxSavedView {
  id: string;
  name: string;
  createdAt: string;
  snapshot: OperatorInboxSavedViewSnapshot;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSnapshot(raw: unknown): OperatorInboxSavedViewSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const filterQuery = typeof o.filterQuery === "string" ? o.filterQuery : "";
  const unansweredOnly = typeof o.unansweredOnly === "boolean" ? o.unansweredOnly : false;
  const pinnedIds = Array.isArray(o.pinnedIds) ? o.pinnedIds.filter((x): x is string => typeof x === "string") : [];
  const bulkFilters = normalizePersistedBulkFilters(o.bulkFilters as OperatorInboxBulkFilters | undefined);
  const compactMode = typeof o.compactMode === "boolean" ? o.compactMode : false;
  const showObservabilityStrip = typeof o.showObservabilityStrip === "boolean" ? o.showObservabilityStrip : true;
  const showAiPreviewPanel = typeof o.showAiPreviewPanel === "boolean" ? o.showAiPreviewPanel : true;
  return {
    filterQuery,
    unansweredOnly,
    pinnedIds,
    bulkFilters,
    compactMode,
    showObservabilityStrip,
    showAiPreviewPanel,
  };
}

export function loadSavedViews(): OperatorInboxSavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: OperatorInboxSavedView[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString();
      const snap = normalizeSnapshot(r.snapshot);
      if (!id || !name || !snap) continue;
      out.push({ id, name, createdAt, snapshot: snap });
    }
    return out.slice(0, MAX_VIEWS);
  } catch {
    return [];
  }
}

export function persistSavedViews(views: OperatorInboxSavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
  } catch {
    /* quota */
  }
}

/** Hydration path only: replace browser cache without producing a server mutation. */
export function replaceSavedViewsFromServer(views: OperatorInboxSavedView[]): void {
  persistSavedViews(views);
}

export function addSavedView(
  views: OperatorInboxSavedView[],
  name: string,
  snapshot: OperatorInboxSavedViewSnapshot,
): OperatorInboxSavedView[] {
  const trimmed = name.trim();
  if (!trimmed) return views;
  const entry: OperatorInboxSavedView = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    snapshot: {
      ...snapshot,
      pinnedIds: [...snapshot.pinnedIds],
      bulkFilters: normalizePersistedBulkFilters(snapshot.bulkFilters),
    },
  };
  const replaced = views.find((view) => view.name.toLowerCase() === trimmed.toLowerCase());
  const next = [entry, ...views.filter((v) => v.name.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_VIEWS);
  persistSavedViews(next);
  if (replaced && replaced.id !== entry.id) {
    enqueueOperatorWorkspaceMutation({ kind: "DELETE_VIEW", viewId: replaced.id });
  }
  enqueueOperatorWorkspaceMutation({
    kind: "SAVE_VIEW",
    viewId: entry.id,
    name: entry.name,
    snapshot: entry.snapshot as unknown as Record<string, unknown>,
  });
  return next;
}

export function removeSavedView(views: OperatorInboxSavedView[], id: string): OperatorInboxSavedView[] {
  const next = views.filter((v) => v.id !== id);
  if (next.length === views.length) return views;
  persistSavedViews(next);
  enqueueOperatorWorkspaceMutation({ kind: "DELETE_VIEW", viewId: id });
  return next;
}
