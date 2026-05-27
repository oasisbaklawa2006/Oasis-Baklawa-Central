import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionReadModelResult, ProjectionSource, ReadModelMetadata } from "./types";
import { isPreviewFallbackEnabled, resolveBoardProjectionSource } from "./previewFallback";

export interface GovernanceBoardState<T> {
  liveRows: T[];
  meta: ReadModelMetadata;
  projectionSource: ProjectionSource;
  loading: boolean;
  loadError: string | null;
  showEmptyLiveMessage: boolean;
  showPreviewCards: boolean;
}

export function useGovernanceBoardState<TInput, TRow extends { input: TInput }>(
  client: SupabaseClient | undefined,
  loader: (c: SupabaseClient) => Promise<ExecutionReadModelResult<TRow>>,
  previewRows: TRow[],
  previewTables: string[],
): GovernanceBoardState<TRow> {
  const [liveResult, setLiveResult] = useState<ExecutionReadModelResult<TRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!client) {
      setLiveResult(null);
      setLoading(false);
      setLoadError("Supabase client unavailable");
      return;
    }
    setLoading(true);
    setLoadError(null);
    void loader(client)
      .then((result) => {
        if (!cancelled) setLiveResult(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Read model load failed");
          setLiveResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, loader]);

  const liveRows = liveResult?.rows ?? [];
  const tablesAvailable = liveResult?.meta.projectionSource !== "unavailable";
  const projectionSource = resolveBoardProjectionSource(liveRows.length, tablesAvailable && !loadError);

  const meta = useMemo((): ReadModelMetadata => {
    if (liveResult?.meta) {
      return { ...liveResult.meta, projectionSource };
    }
    return {
      projectionSource,
      derivedFromTables: previewTables,
      missingSignals: loadError ? [loadError] : [],
      evaluatedAt: new Date().toISOString(),
    };
  }, [liveResult, projectionSource, previewTables, loadError]);

  const showPreviewCards =
    liveRows.length === 0 && isPreviewFallbackEnabled() && !loading && !loadError;
  const showEmptyLiveMessage =
    liveRows.length === 0 && !isPreviewFallbackEnabled() && !loading && !loadError;

  return {
    liveRows,
    meta,
    projectionSource,
    loading,
    loadError,
    showEmptyLiveMessage,
    showPreviewCards,
  };
}
