/** Row shape returned by Core `published_products_v1()` — read-only operational projection. */
export type PublishedProductProjectionRow = {
  product_id: string;
  sku: string;
  product_name: string;
  short_description: string | null;
  long_description: string | null;
  category: string | null;
  subcategory: string | null;
  hero_image_url: string | null;
  pack_size: string | null;
  storage_type: string | null;
  shelf_life: string | null;
  shelf_life_days: number | null;
  dietary_tags: string[] | null;
  allergen_warnings: string | null;
  primary_uom: string | null;
  created_at: string;
};

/** Central-facing read model for governed publication status surfaces. */
export type PublishedOperationalProduct = {
  productId: string;
  sku: string;
  productName: string;
  shortDescription: string | null;
  longDescription: string | null;
  category: string | null;
  subcategory: string | null;
  heroImageUrl: string | null;
  packSize: string | null;
  storageType: string | null;
  shelfLife: string | null;
  shelfLifeDays: number | null;
  dietaryTags: string[];
  allergenWarnings: string | null;
  primaryUom: string | null;
  publishedAt: string;
};

export type PublishedOperationalProductIndex = {
  byProductId: Map<string, PublishedOperationalProduct>;
  bySku: Map<string, PublishedOperationalProduct>;
  products: PublishedOperationalProduct[];
  loadedAt: string;
};
