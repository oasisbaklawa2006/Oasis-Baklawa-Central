import { parseOperationalSearchQuery } from "./searchQueryParser";
import { rankSearchEntries } from "./searchResultRanking";
import {
  filterIndexEntryForAuthority,
  sanitizeResultCardText,
} from "./searchVisibilityGuard";
import { toResultCard } from "./searchIndexProjectionBuilder";
import type {
  OperationalSearchIndexQuery,
  OperationalSearchIndexQueryResult,
  SearchAuthorityContext,
  SearchIndexEntry,
  SearchIndexUpsertInput,
} from "./searchIndexTypes";

export interface SearchIndexStoreAdapter {
  upsertEntry(input: SearchIndexUpsertInput): Promise<SearchIndexEntry>;
  bulkUpsert(inputs: SearchIndexUpsertInput[]): Promise<SearchIndexEntry[]>;
  listForSearch(query: OperationalSearchIndexQuery): Promise<SearchIndexEntry[]>;
  getByEntity(entityType: string, entityId: string, source: string): Promise<SearchIndexEntry | null>;
  markStale?(entityType: string, entityId: string, source: string): Promise<void>;
}

export interface SearchIndexRepository {
  upsertSearchIndexEntry(input: SearchIndexUpsertInput): Promise<SearchIndexEntry>;
  bulkUpsertSearchIndexEntries(inputs: SearchIndexUpsertInput[]): Promise<SearchIndexEntry[]>;
  searchOperationalIndex(
    query: OperationalSearchIndexQuery,
    authority: SearchAuthorityContext,
  ): Promise<OperationalSearchIndexQueryResult>;
  getSearchIndexEntry(entityType: string, entityId: string, source: string): Promise<SearchIndexEntry | null>;
  markSearchIndexEntryStale(entityType: string, entityId: string, source: string): Promise<void>;
}

export function createSearchIndexRepository(store: SearchIndexStoreAdapter): SearchIndexRepository {
  return {
    upsertSearchIndexEntry: (input) => store.upsertEntry(input),
    bulkUpsertSearchIndexEntries: (inputs) => store.bulkUpsert(inputs),
    getSearchIndexEntry: (entityType, entityId, source) => store.getByEntity(entityType, entityId, source),

    async markSearchIndexEntryStale(entityType, entityId, source) {
      if (store.markStale) {
        await store.markStale(entityType, entityId, source);
        return;
      }
      const existing = await store.getByEntity(entityType, entityId, source);
      if (!existing?.id) return;
      await store.upsertEntry({
        ...existing,
        metadata: { ...existing.metadata, stale: true },
        searchSubtitle: existing.searchSubtitle ?? "stale",
      });
    },

    async searchOperationalIndex(query, authority) {
      const parsed = parseOperationalSearchQuery(query.text);
      const rows = await store.listForSearch(query);
      let suppressedCount = 0;
      const allowed: SearchIndexEntry[] = [];

      for (const row of rows) {
        const gate = filterIndexEntryForAuthority(row, authority);
        if (!gate.allowed) {
          suppressedCount += 1;
          continue;
        }
        allowed.push(row);
      }

      const ranked = rankSearchEntries(allowed, parsed);
      const limit = query.limit ?? 40;
      const cards = ranked.slice(0, limit).map((entry) => {
        const sanitized = sanitizeResultCardText(
          entry.searchTitle,
          entry.searchSubtitle,
          entry.visibility,
        );
        return toResultCard({
          ...entry,
          searchTitle: sanitized.title,
          searchSubtitle: sanitized.subtitle,
          rankScore: entry.rankScore,
        });
      });

      return {
        cards,
        totalMatched: ranked.length,
        suppressedCount,
        queryTokens: parsed.tokens,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}
