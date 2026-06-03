import type { CatalogueQuantityProduct } from "./quantityResolutionNormalize";

export function serializeCatalogueQuantityFingerprint(
  product: CatalogueQuantityProduct | null | undefined,
): string {
  if (!product) return "catalogue:none";
  return [
    "catalogue",
    product.weight_per_box_kg ?? "",
    product.grams_per_piece ?? "",
    product.packs_per_master_carton ?? "",
    product.packs_per_carton ?? "",
    product.pcs_per_master_carton ?? "",
    product.category ?? "",
    product.uom ?? "",
  ].join(":");
}

export function buildQuantityResolutionResultCacheKey(
  requestKey: string,
  product: CatalogueQuantityProduct | null | undefined,
): string {
  return `${requestKey}|${serializeCatalogueQuantityFingerprint(product)}`;
}
