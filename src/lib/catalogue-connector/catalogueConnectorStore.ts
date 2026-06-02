import type {
  ApprovedCatalogueProductSnapshot,
  CatalogueProductMappingRecord,
  CatalogueSyncResult,
} from "./catalogueConnectorTypes";

export interface CatalogueConnectorProductRow {
  id: string;
  sku: string;
  name: string;
}

export interface CatalogueConnectorStore {
  findMappingByExternalId(
    sourceApp: string,
    externalId: string,
  ): Promise<CatalogueProductMappingRecord | null>;

  findMappingBySku(sourceApp: string, sku: string): Promise<CatalogueProductMappingRecord | null>;

  findProductById(productId: string): Promise<CatalogueConnectorProductRow | null>;

  findProductBySku(sku: string): Promise<CatalogueConnectorProductRow | null>;

  insertProduct(row: Record<string, unknown>): Promise<CatalogueConnectorProductRow>;

  updateProduct(productId: string, patch: Record<string, unknown>): Promise<CatalogueConnectorProductRow>;

  upsertMapping(row: {
    external_catalogue_product_id: string;
    central_product_id: string | null;
    sku: string;
    source_app: string;
    source_version: number;
    sync_status: string;
    last_synced_at: string;
    metadata: Record<string, unknown>;
  }): Promise<CatalogueProductMappingRecord>;
}

export type SyncApprovedCatalogueProductFn = (
  snapshot: ApprovedCatalogueProductSnapshot,
  sourceApp?: string,
) => Promise<CatalogueSyncResult>;
