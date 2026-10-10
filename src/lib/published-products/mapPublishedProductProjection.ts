import type { PublishedOperationalProduct, PublishedProductProjectionRow } from "./types";

/** Deterministic Core projection row → Central operational read model. */
export function mapPublishedProductProjectionRow(
  row: PublishedProductProjectionRow,
): PublishedOperationalProduct {
  return {
    productId: row.product_id,
    sku: row.sku.trim(),
    productName: row.product_name.trim(),
    shortDescription: row.short_description,
    longDescription: row.long_description,
    category: row.category,
    subcategory: row.subcategory,
    heroImageUrl: row.hero_image_url,
    packSize: row.pack_size,
    storageType: row.storage_type,
    shelfLife: row.shelf_life,
    shelfLifeDays: row.shelf_life_days,
    dietaryTags: row.dietary_tags ?? [],
    allergenWarnings: row.allergen_warnings,
    primaryUom: row.primary_uom,
    publishedAt: row.created_at,
  };
}

export function buildPublishedOperationalProductIndex(
  rows: PublishedProductProjectionRow[],
  loadedAt = new Date().toISOString(),
): {
  byProductId: Map<string, PublishedOperationalProduct>;
  bySku: Map<string, PublishedOperationalProduct>;
  products: PublishedOperationalProduct[];
  loadedAt: string;
} {
  const products = rows.map(mapPublishedProductProjectionRow);
  const byProductId = new Map<string, PublishedOperationalProduct>();
  const bySku = new Map<string, PublishedOperationalProduct>();

  for (const product of products) {
    byProductId.set(product.productId, product);
    bySku.set(product.sku, product);
  }

  return { byProductId, bySku, products, loadedAt };
}
