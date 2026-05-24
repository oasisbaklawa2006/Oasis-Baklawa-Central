import type { OperationalSearchHit, OperationalSearchQuery, OperationalSearchResult } from "./searchEntityContracts";
import { SEARCH_KIND_LABELS } from "./searchEntityContracts";
import { inferSearchKindFromQuery } from "./searchAliases";
import { sortSearchHits } from "./searchPriority";
import { groupSearchHits } from "./searchGrouping";

const ALL_KINDS = Object.keys(SEARCH_KIND_LABELS) as OperationalSearchHit["kind"][];

export function searchOperationalIndex(
  hits: OperationalSearchHit[],
  query: OperationalSearchQuery,
): OperationalSearchResult {
  const text = query.text.trim().toLowerCase();
  const limit = query.limit ?? 50;
  const allowedKinds = query.kinds ? new Set(query.kinds) : null;

  let filtered = hits;
  if (allowedKinds) {
    filtered = filtered.filter((h) => allowedKinds.has(h.kind));
  }
  if (text) {
    const inferred = inferSearchKindFromQuery(query.text);
    filtered = filtered.filter(
      (h) =>
        h.query.toLowerCase().includes(text) ||
        h.label.toLowerCase().includes(text) ||
        h.entityId.toLowerCase() === text ||
        (inferred !== null && h.kind === inferred),
    );
  }

  const sorted = sortSearchHits(filtered).slice(0, limit);
  const presentKinds = new Set(sorted.map((h) => h.kind));
  const pendingKinds = ALL_KINDS.filter((k) => !presentKinds.has(k) && (!allowedKinds || allowedKinds.has(k)));

  return {
    hits: sorted,
    pendingKinds,
    generatedAt: new Date().toISOString(),
  };
}

export function emptySearchResult(): OperationalSearchResult {
  return {
    hits: [],
    pendingKinds: ALL_KINDS,
    generatedAt: new Date().toISOString(),
  };
}

export { groupSearchHits };
