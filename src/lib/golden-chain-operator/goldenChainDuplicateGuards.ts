import type { FinalizationLineageSlice } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";

/** True when dispatch_release_lineage already has a governed finalize row for this order. */
export function hasGovernedDispatchFinalizeLineage(lineage: FinalizationLineageSlice[]): boolean {
  return lineage.some((row) => row.releaseType === "finalize");
}

export function dispatchFinalizeGuardMessage(lineage: FinalizationLineageSlice[]): string | null {
  if (!hasGovernedDispatchFinalizeLineage(lineage)) return null;
  const row = lineage.find((l) => l.releaseType === "finalize");
  const when = row?.createdAt ? new Date(row.createdAt).toLocaleString() : "earlier";
  return `Already finalized (${when}) — dispatch_release_lineage release_type=finalize exists.`;
}
