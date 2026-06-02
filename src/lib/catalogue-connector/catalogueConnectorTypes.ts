/** Approved snapshot published by AI Catalogue Builder (external app). */
export type CatalogueProductStatus = "active" | "inactive";

export interface ApprovedCatalogueProductSnapshot {
  external_catalogue_product_id: string;
  /** Set when re-syncing an already-mapped product. */
  central_product_id?: string | null;
  sku: string;
  product_name: string;
  product_description?: string | null;
  approved_image_urls: string[];
  mrp?: number | null;
  base_price?: number | null;
  pack_size?: string | null;
  net_weight_grams?: number | null;
  avg_weight_per_pack?: number | null;
  category: string;
  sub_category?: string | null;
  hsn_code: string;
  gst_rate?: number | null;
  uom?: string | null;
  barcode_sku?: string | null;
  status: CatalogueProductStatus;
  version: number;
  updated_at: string;
}

export type CatalogueSyncStatus =
  | "pending"
  | "synced"
  | "deactivated"
  | "error"
  | "skipped_stale";

export interface CatalogueProductMappingRecord {
  id: string;
  external_catalogue_product_id: string;
  central_product_id: string | null;
  sku: string;
  source_app: string;
  source_version: number;
  sync_status: CatalogueSyncStatus;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CatalogueSyncProductResult {
  central_product_id: string;
  sku: string;
  created: boolean;
  deactivated: boolean;
  image_url: string | null;
}

export interface CatalogueSyncResult {
  external_catalogue_product_id: string;
  sku: string;
  sync_status: CatalogueSyncStatus;
  mapping_id: string;
  product?: CatalogueSyncProductResult;
  error?: string;
}

export const DEFAULT_CATALOGUE_SOURCE_APP = "ai_catalogue_builder";
