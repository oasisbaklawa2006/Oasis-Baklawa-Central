import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogueProductMappingRecord } from "./catalogueConnectorTypes";
import type { CatalogueConnectorProductRow, CatalogueConnectorStore } from "./catalogueConnectorStore";
import { normalizeCatalogueSku } from "./catalogueConnectorLogic";

function mapMappingRow(row: Record<string, unknown>): CatalogueProductMappingRecord {
  return {
    id: String(row.id),
    external_catalogue_product_id: String(row.external_catalogue_product_id),
    central_product_id: row.central_product_id ? String(row.central_product_id) : null,
    sku: String(row.sku),
    source_app: String(row.source_app),
    source_version: Number(row.source_version),
    sync_status: row.sync_status as CatalogueProductMappingRecord["sync_status"],
    last_synced_at: row.last_synced_at ? String(row.last_synced_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function createSupabaseCatalogueConnectorStore(client: SupabaseClient): CatalogueConnectorStore {
  return {
    async findMappingByExternalId(sourceApp, externalId) {
      const { data, error } = await client
        .from("catalogue_product_mappings")
        .select("*")
        .eq("source_app", sourceApp)
        .eq("external_catalogue_product_id", externalId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapMappingRow(data as Record<string, unknown>) : null;
    },

    async findMappingBySku(sourceApp, sku) {
      const { data, error } = await client
        .from("catalogue_product_mappings")
        .select("*")
        .eq("source_app", sourceApp)
        .eq("sku", normalizeCatalogueSku(sku))
        .maybeSingle();
      if (error) throw error;
      return data ? mapMappingRow(data as Record<string, unknown>) : null;
    },

    async findProductById(productId) {
      const { data, error } = await client
        .from("products")
        .select("id, sku, name")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, sku: data.sku, name: data.name };
    },

    async findProductBySku(sku) {
      const normalized = normalizeCatalogueSku(sku);
      const { data, error } = await client
        .from("products")
        .select("id, sku, name")
        .eq("sku", normalized)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { id: data.id, sku: data.sku, name: data.name };
    },

    async insertProduct(row) {
      const { data, error } = await client.from("products").insert(row).select("id, sku, name").single();
      if (error) throw error;
      return data as CatalogueConnectorProductRow;
    },

    async updateProduct(productId, patch) {
      const { data, error } = await client
        .from("products")
        .update(patch)
        .eq("id", productId)
        .select("id, sku, name")
        .single();
      if (error) throw error;
      return data as CatalogueConnectorProductRow;
    },

    async upsertMapping(row) {
      const { data, error } = await client
        .from("catalogue_product_mappings")
        .upsert(
          {
            external_catalogue_product_id: row.external_catalogue_product_id,
            central_product_id: row.central_product_id,
            sku: row.sku,
            source_app: row.source_app,
            source_version: row.source_version,
            sync_status: row.sync_status,
            last_synced_at: row.last_synced_at,
            metadata: row.metadata,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_app,external_catalogue_product_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return mapMappingRow(data as Record<string, unknown>);
    },
  };
}
