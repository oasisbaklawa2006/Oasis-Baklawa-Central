import { describe, expect, it, vi } from "vitest";
import {
  buildPublishedOperationalProductIndex,
  mapPublishedProductProjectionRow,
} from "../mapPublishedProductProjection";
import {
  fetchPublishedOperationalProducts,
  isProductPublishedOperational,
} from "../publishedProductsClient";
import type { PublishedProductProjectionRow } from "../types";

function publishedRow(
  overrides: Partial<PublishedProductProjectionRow> = {},
): PublishedProductProjectionRow {
  return {
    product_id: "prod-1",
    sku: "OAS-PUR-1",
    product_name: "Premium Pack",
    short_description: "Short copy",
    long_description: "Long copy",
    category: "Ready Packs",
    subcategory: "Premium",
    hero_image_url: "https://cdn.example.com/p.jpg",
    pack_size: "500g",
    storage_type: "ambient",
    shelf_life: "180 days",
    shelf_life_days: 180,
    dietary_tags: ["Vegetarian"],
    allergen_warnings: "Contains nuts",
    primary_uom: "Pc",
    created_at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

describe("mapPublishedProductProjectionRow", () => {
  it("maps Core projection rows deterministically", () => {
    const mapped = mapPublishedProductProjectionRow(publishedRow());
    expect(mapped).toEqual({
      productId: "prod-1",
      sku: "OAS-PUR-1",
      productName: "Premium Pack",
      shortDescription: "Short copy",
      longDescription: "Long copy",
      category: "Ready Packs",
      subcategory: "Premium",
      heroImageUrl: "https://cdn.example.com/p.jpg",
      packSize: "500g",
      storageType: "ambient",
      shelfLife: "180 days",
      shelfLifeDays: 180,
      dietaryTags: ["Vegetarian"],
      allergenWarnings: "Contains nuts",
      primaryUom: "Pc",
      publishedAt: "2026-06-01T12:00:00Z",
    });
  });

  it("normalizes nullable dietary tags to an empty array", () => {
    expect(mapPublishedProductProjectionRow(publishedRow({ dietary_tags: null })).dietaryTags).toEqual([]);
  });
});

describe("buildPublishedOperationalProductIndex", () => {
  it("excludes unpublished or rejected rows because Core projection already filters them", () => {
    const index = buildPublishedOperationalProductIndex([
      publishedRow({ product_id: "published", sku: "PUB-1" }),
    ]);

    expect(index.products).toHaveLength(1);
    expect(index.byProductId.has("draft-only")).toBe(false);
    expect(index.bySku.has("DRAFT-1")).toBe(false);
    expect(isProductPublishedOperational(index, "published")).toBe(true);
    expect(isProductPublishedOperational(index, "draft-only")).toBe(false);
  });

  it("indexes published rows by product id and sku", () => {
    const index = buildPublishedOperationalProductIndex([
      publishedRow({ product_id: "a", sku: "SKU-A" }),
      publishedRow({ product_id: "b", sku: "SKU-B", product_name: "Second" }),
    ]);

    expect(index.byProductId.get("a")?.sku).toBe("SKU-A");
    expect(index.bySku.get("SKU-B")?.productName).toBe("Second");
  });
});

describe("fetchPublishedOperationalProducts", () => {
  it("reads only through published_products_v1 RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [publishedRow()],
      error: null,
    });
    const supabase = { rpc } as never;

    const index = await fetchPublishedOperationalProducts(supabase);

    expect(rpc).toHaveBeenCalledWith("published_products_v1");
    expect(index.products).toHaveLength(1);
    expect(index.byProductId.get("prod-1")?.productName).toBe("Premium Pack");
  });

  it("surfaces RPC failures without falling back to products table reads", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } }),
    } as never;

    await expect(fetchPublishedOperationalProducts(supabase)).rejects.toThrow(
      "published_products_v1 read failed: permission denied",
    );
  });
});
