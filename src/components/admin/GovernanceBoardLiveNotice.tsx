import type { ReadModelMetadata } from "@/lib/execution-read-models";

export function GovernanceBoardLiveNotice({
  meta,
  loading,
  loadError,
  showEmptyLiveMessage,
  showPreviewCards,
  showUnavailableMessage,
}: {
  meta: ReadModelMetadata;
  loading: boolean;
  loadError: string | null;
  showEmptyLiveMessage: boolean;
  showPreviewCards: boolean;
  showUnavailableMessage: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading live governance signals…</p>;
  }
  if (loadError) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Live read unavailable: {loadError}
      </p>
    );
  }
  if (showUnavailableMessage) {
    return (
      <p className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
        Live governance tables are unavailable (missing tables or access denied). No sample cards are shown.
        {meta.missingSignals.length > 0 ? ` · ${meta.missingSignals.slice(0, 3).join(", ")}` : ""}
      </p>
    );
  }
  if (showEmptyLiveMessage) {
    return (
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        No live orders match this governance board. Enable preview cards with{" "}
        <code className="text-xs">VITE_EXECUTION_PREVIEW_FALLBACK=true</code> for staging samples only.
      </p>
    );
  }
  if (showPreviewCards) {
    return (
      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
        Preview cards (non-production). Source: {meta.projectionSource} · tables:{" "}
        {meta.derivedFromTables.join(", ") || "n/a"}
      </p>
    );
  }
  if (meta.projectionSource === "live") {
    return (
      <p className="text-xs text-muted-foreground">
        Live signals · {meta.derivedFromTables.join(", ")}
        {meta.missingSignals.length > 0 ? ` · gaps: ${meta.missingSignals.slice(0, 4).join(", ")}` : ""}
      </p>
    );
  }
  return null;
}
