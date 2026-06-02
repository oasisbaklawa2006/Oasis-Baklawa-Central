import type { CatalogueProductMappingRecord } from "./catalogueConnectorTypes";
import type { CatalogueConnectorProductRow, CatalogueConnectorStore } from "./catalogueConnectorStore";

let idSeq = 1;
function nextId(): string {
  return `00000000-0000-4000-8000-${String(idSeq++).padStart(12, "0")}`;
}

export function createInMemoryCatalogueConnectorStore(): CatalogueConnectorStore & {
  mappings: CatalogueProductMappingRecord[];
  products: CatalogueConnectorProductRow[];
} {
  const mappings: CatalogueProductMappingRecord[] = [];
  const products: (CatalogueConnectorProductRow & Record<string, unknown>)[] = [];

  return {
    mappings,
    products,

    async findMappingByExternalId(sourceApp, externalId) {
      return (
        mappings.find(
          (m) => m.source_app === sourceApp && m.external_catalogue_product_id === externalId,
        ) ?? null
      );
    },

    async findMappingBySku(sourceApp, sku) {
      return mappings.find((m) => m.source_app === sourceApp && m.sku === sku) ?? null;
    },

    async findProductById(productId) {
      const p = products.find((x) => x.id === productId);
      return p ? { id: p.id, sku: p.sku, name: p.name } : null;
    },

    async findProductBySku(sku) {
      const p = products.find((x) => x.sku === sku);
      return p ? { id: p.id, sku: p.sku, name: p.name } : null;
    },

    async insertProduct(row) {
      const id = nextId();
      const sku = String(row.sku);
      const name = String(row.name);
      products.push({ id, sku, name, ...row });
      return { id, sku, name };
    },

    async updateProduct(productId, patch) {
      const idx = products.findIndex((x) => x.id === productId);
      if (idx < 0) throw new Error(`product not found: ${productId}`);
      products[idx] = {
        ...products[idx],
        ...patch,
        id: productId,
        sku: String(patch.sku ?? products[idx].sku),
        name: String(patch.name ?? products[idx].name),
      };
      return {
        id: productId,
        sku: products[idx].sku,
        name: products[idx].name,
      };
    },

    async upsertMapping(row) {
      const existingIdx = mappings.findIndex(
        (m) =>
          m.source_app === row.source_app &&
          m.external_catalogue_product_id === row.external_catalogue_product_id,
      );
      const now = new Date().toISOString();
      if (existingIdx >= 0) {
        mappings[existingIdx] = {
          ...mappings[existingIdx],
          ...row,
          sync_status: row.sync_status as CatalogueProductMappingRecord["sync_status"],
          updated_at: now,
        };
        return mappings[existingIdx];
      }
      const record: CatalogueProductMappingRecord = {
        id: nextId(),
        external_catalogue_product_id: row.external_catalogue_product_id,
        central_product_id: row.central_product_id,
        sku: row.sku,
        source_app: row.source_app,
        source_version: row.source_version,
        sync_status: row.sync_status as CatalogueProductMappingRecord["sync_status"],
        last_synced_at: row.last_synced_at,
        metadata: row.metadata,
        created_at: now,
        updated_at: now,
      };
      mappings.push(record);
      return record;
    },
  };
}
