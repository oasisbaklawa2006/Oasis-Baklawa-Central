/**
 * SELECT-only governance read models — metadata travels with every result.
 */

export type ProjectionSource = "live" | "preview" | "empty" | "unavailable";

export interface ReadModelMetadata {
  projectionSource: ProjectionSource;
  derivedFromTables: string[];
  missingSignals: string[];
  evaluatedAt: string;
}

export interface ExecutionReadModelResult<T> {
  rows: T[];
  meta: ReadModelMetadata;
}

export interface DerivedSignalMeta {
  signalGeneratedAt: string | null;
  signalAgeMs: number | null;
  stale: boolean;
}

export function buildReadModelMeta(params: {
  projectionSource: ProjectionSource;
  derivedFromTables: string[];
  missingSignals?: string[];
}): ReadModelMetadata {
  return {
    projectionSource: params.projectionSource,
    derivedFromTables: params.derivedFromTables,
    missingSignals: params.missingSignals ?? [],
    evaluatedAt: new Date().toISOString(),
  };
}

export function emptyReadModelResult<T>(
  source: ProjectionSource,
  tables: string[],
  missingSignals: string[] = [],
): ExecutionReadModelResult<T> {
  return {
    rows: [],
    meta: buildReadModelMeta({
      projectionSource: source,
      derivedFromTables: tables,
      missingSignals,
    }),
  };
}
