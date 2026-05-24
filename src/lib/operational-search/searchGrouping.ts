import type { OperationalSearchHit } from "./searchEntityContracts";
import { SEARCH_KIND_LABELS } from "./searchEntityContracts";

export interface SearchResultGroup {
  group: string;
  hits: OperationalSearchHit[];
}

export function groupSearchHits(hits: OperationalSearchHit[]): SearchResultGroup[] {
  const map = new Map<string, OperationalSearchHit[]>();
  for (const hit of hits) {
    const key = hit.group || SEARCH_KIND_LABELS[hit.kind];
    const list = map.get(key) ?? [];
    list.push(hit);
    map.set(key, list);
  }
  return [...map.entries()].map(([group, groupHits]) => ({ group, hits: groupHits }));
}
