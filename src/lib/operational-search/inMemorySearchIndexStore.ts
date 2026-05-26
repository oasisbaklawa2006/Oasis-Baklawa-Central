import type { SearchIndexStoreAdapter } from "./searchIndexRepository";
import type { OperationalSearchIndexQuery, SearchIndexEntry, SearchIndexUpsertInput } from "./searchIndexTypes";
import { parseOperationalSearchQuery } from "./searchQueryParser";

function key(entityType: string, entityId: string, source: string): string {
  return `${entityType}:${entityId}:${source}`;
}

export function createInMemorySearchIndexStore(seed: SearchIndexEntry[] = []): SearchIndexStoreAdapter {
  const map = new Map<string, SearchIndexEntry>();
  for (const e of seed) {
    map.set(key(e.entityType, e.entityId, e.source), { ...e, id: e.id ?? crypto.randomUUID() });
  }

  return {
    async upsertEntry(input: SearchIndexUpsertInput) {
      const k = key(input.entityType, input.entityId, input.source);
      const existing = map.get(k);
      const entry: SearchIndexEntry = {
        ...input,
        id: existing?.id ?? crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      map.set(k, entry);
      return entry;
    },

    async bulkUpsert(inputs) {
      const out: SearchIndexEntry[] = [];
      for (const input of inputs) {
        out.push(await this.upsertEntry(input));
      }
      return out;
    },

    async getByEntity(entityType, entityId, source) {
      return map.get(key(entityType, entityId, source)) ?? null;
    },

    async markStale(entityType, entityId, source) {
      const e = map.get(key(entityType, entityId, source));
      if (!e) return;
      map.set(key(entityType, entityId, source), {
        ...e,
        metadata: { ...e.metadata, stale: true },
        updatedAt: new Date().toISOString(),
      });
    },

    async listForSearch(query: OperationalSearchIndexQuery) {
      const parsed = parseOperationalSearchQuery(query.text);
      let rows = [...map.values()];

      if (query.entityTypes?.length) {
        const set = new Set(query.entityTypes);
        rows = rows.filter((r) => set.has(r.entityType));
      }
      if (query.department) {
        rows = rows.filter((r) => r.department?.toLowerCase() === query.department!.toLowerCase());
      }
      if (query.sensitivity) {
        rows = rows.filter((r) => r.sensitivity === query.sensitivity);
      }
      if (query.visibility) {
        rows = rows.filter((r) => r.visibility === query.visibility);
      }
      if (query.updatedAfter) {
        rows = rows.filter((r) => (r.updatedAt ?? "") >= query.updatedAfter!);
      }
      if (query.updatedBefore) {
        rows = rows.filter((r) => (r.updatedAt ?? "") <= query.updatedBefore!);
      }

      if (!parsed.tokens.length) return rows;

      return rows.filter((row) => {
        const hay = [
          ...row.normalizedTokens,
          ...row.aliases,
          ...row.soNumbers,
          ...row.barcodeValues,
          row.searchTitle,
          row.publicRef ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return parsed.tokens.some((t) => hay.includes(t) || hay.includes(t.replace(/^so/, "so-")));
      });
    },
  };
}
