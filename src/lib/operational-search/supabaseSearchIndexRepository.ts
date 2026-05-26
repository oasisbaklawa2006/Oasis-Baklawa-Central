import type { SupabaseClient } from "@supabase/supabase-js";
import { createInMemorySearchIndexStore } from "./inMemorySearchIndexStore";
import { createSearchIndexRepository } from "./searchIndexRepository";
import type { SearchIndexStoreAdapter } from "./searchIndexRepository";
import type { OperationalSearchIndexQuery, SearchIndexEntry, SearchIndexUpsertInput } from "./searchIndexTypes";
import { parseOperationalSearchQuery } from "./searchQueryParser";

type SearchIndexRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  order_id: string | null;
  customer_id: string | null;
  queue_item_id: string | null;
  scan_record_id: string | null;
  event_id: string | null;
  public_ref: string | null;
  search_title: string;
  search_subtitle: string | null;
  search_body: string | null;
  normalized_tokens: string[];
  aliases: string[];
  barcode_values: string[];
  so_numbers: string[];
  phone_tokens: string[];
  email_tokens: string[];
  department: string | null;
  visibility: string;
  sensitivity: string;
  source: string;
  metadata: Record<string, unknown>;
  updated_at: string;
  created_at: string;
};

function rowToEntry(row: SearchIndexRow): SearchIndexEntry {
  return {
    id: row.id,
    entityType: row.entity_type as SearchIndexEntry["entityType"],
    entityId: row.entity_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    queueItemId: row.queue_item_id,
    scanRecordId: row.scan_record_id,
    eventId: row.event_id,
    publicRef: row.public_ref,
    searchTitle: row.search_title,
    searchSubtitle: row.search_subtitle,
    searchBody: row.search_body,
    normalizedTokens: row.normalized_tokens ?? [],
    aliases: row.aliases ?? [],
    barcodeValues: row.barcode_values ?? [],
    soNumbers: row.so_numbers ?? [],
    phoneTokens: row.phone_tokens ?? [],
    emailTokens: row.email_tokens ?? [],
    department: row.department,
    visibility: row.visibility as SearchIndexEntry["visibility"],
    sensitivity: row.sensitivity as SearchIndexEntry["sensitivity"],
    source: row.source,
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function entryToRow(input: SearchIndexUpsertInput): Record<string, unknown> {
  return {
    entity_type: input.entityType,
    entity_id: input.entityId,
    order_id: input.orderId,
    customer_id: input.customerId,
    queue_item_id: input.queueItemId,
    scan_record_id: input.scanRecordId,
    event_id: input.eventId,
    public_ref: input.publicRef,
    search_title: input.searchTitle,
    search_subtitle: input.searchSubtitle,
    search_body: input.searchBody,
    normalized_tokens: input.normalizedTokens,
    aliases: input.aliases,
    barcode_values: input.barcodeValues,
    so_numbers: input.soNumbers,
    phone_tokens: input.phoneTokens,
    email_tokens: input.emailTokens,
    department: input.department,
    visibility: input.visibility,
    sensitivity: input.sensitivity,
    source: input.source,
    metadata: input.metadata,
    updated_at: new Date().toISOString(),
  };
}

function createSupabaseSearchIndexStore(client: SupabaseClient): SearchIndexStoreAdapter {
  const table = () => client.from("operational_search_index" as "operational_queue_items");

  return {
    async upsertEntry(input) {
      const row = entryToRow(input);
      const { data, error } = await table()
        .upsert(row as never, { onConflict: "entity_type,entity_id,source" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return rowToEntry(data as SearchIndexRow);
    },

    async bulkUpsert(inputs) {
      if (!inputs.length) return [];
      const rows = inputs.map(entryToRow);
      const { data, error } = await table().upsert(rows as never, { onConflict: "entity_type,entity_id,source" }).select("*");
      if (error) throw new Error(error.message);
      return ((data ?? []) as SearchIndexRow[]).map(rowToEntry);
    },

    async getByEntity(entityType, entityId, source) {
      const { data, error } = await table()
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("source", source)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToEntry(data as SearchIndexRow) : null;
    },

    async markStale(entityType, entityId, source) {
      const existing = await this.getByEntity(entityType, entityId, source);
      if (!existing) return;
      await this.upsertEntry({
        ...existing,
        metadata: { ...existing.metadata, stale: true },
      });
    },

    async listForSearch(query: OperationalSearchIndexQuery) {
      const parsed = parseOperationalSearchQuery(query.text);
      let q = table().select("*").order("updated_at", { ascending: false }).limit(200);

      if (query.entityTypes?.length) {
        q = q.in("entity_type", query.entityTypes);
      }
      if (query.department) {
        q = q.eq("department", query.department);
      }
      if (query.sensitivity) {
        q = q.eq("sensitivity", query.sensitivity);
      }
      if (query.visibility) {
        q = q.eq("visibility", query.visibility);
      }
      if (query.updatedAfter) {
        q = q.gte("updated_at", query.updatedAfter);
      }
      if (query.updatedBefore) {
        q = q.lte("updated_at", query.updatedBefore);
      }

      if (parsed.tokens.length === 1) {
        q = q.overlaps("normalized_tokens", parsed.tokens);
      }

      const { data, error } = await q;
      if (error) {
        if (error.message.includes("operational_search_index") || error.code === "42P01") {
          return [];
        }
        throw new Error(error.message);
      }

      let rows = ((data ?? []) as SearchIndexRow[]).map(rowToEntry);
      if (parsed.tokens.length > 1) {
        rows = rows.filter((row) =>
          parsed.tokens.some(
            (t) =>
              row.normalizedTokens.includes(t) ||
              row.soNumbers.some((s) => s.toLowerCase().includes(t)) ||
              row.barcodeValues.some((b) => b.toLowerCase().includes(t)),
          ),
        );
      }
      if (parsed.barcodeOrSoMode && parsed.tokens.length) {
        const token = parsed.tokens[0];
        rows = rows.filter(
          (row) =>
            row.barcodeValues.some((b) => b.toLowerCase().includes(token)) ||
            row.soNumbers.some((s) => s.toLowerCase().includes(token)) ||
            row.normalizedTokens.includes(token),
        );
      }
      return rows;
    },
  };
}

export function createSupabaseSearchIndexRepository(client: SupabaseClient) {
  return createSearchIndexRepository(createSupabaseSearchIndexStore(client));
}

/** Fallback in-memory repository when table is unavailable (local/tests). */
export function createFallbackSearchIndexRepository(seed: SearchIndexEntry[] = []) {
  return createSearchIndexRepository(createInMemorySearchIndexStore(seed));
}
