import type { ApprovedCatalogueProductSnapshot } from "./catalogueConnectorTypes";

/** First non-empty HTTPS/HTTP URL from approved media list. */
export function selectPrimaryImageUrl(approvedImageUrls: string[] | null | undefined): string | null {
  if (!approvedImageUrls?.length) return null;
  for (const raw of approvedImageUrls) {
    const url = raw?.trim();
    if (!url) continue;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
  }
  return null;
}

export function normalizeCatalogueSku(sku: string): string {
  return sku.trim().toUpperCase();
}

export function isStaleCatalogueVersion(
  incomingVersion: number,
  existingVersion: number | null | undefined,
): boolean {
  if (existingVersion == null) return false;
  return incomingVersion < existingVersion;
}

export function buildProductPatchFromSnapshot(snapshot: ApprovedCatalogueProductSnapshot): Record<string, unknown> {
  const active = snapshot.status === "active";
  const imageUrl = selectPrimaryImageUrl(snapshot.approved_image_urls);
  const gst = snapshot.gst_rate ?? 0;

  return {
    name: snapshot.product_name.trim(),
    sku: normalizeCatalogueSku(snapshot.sku),
    description: snapshot.product_description?.trim() || null,
    category: snapshot.category.trim() || "General",
    sub_category: snapshot.sub_category?.trim() || null,
    image_url: imageUrl,
    mrp: snapshot.mrp ?? null,
    base_price: snapshot.base_price ?? null,
    wholesale_price: snapshot.base_price ?? null,
    price_per_kg: snapshot.base_price ?? null,
    pack_size: snapshot.pack_size ?? null,
    net_weight_grams: snapshot.net_weight_grams ?? null,
    avg_weight_per_pack: snapshot.avg_weight_per_pack ?? null,
    hsn_code: snapshot.hsn_code.trim(),
    gst_percentage: Math.round(gst),
    gst_rate: gst,
    uom: snapshot.uom?.trim() || "Pc",
    barcode_sku: snapshot.barcode_sku?.trim() || null,
    is_active: active,
    visible_in_catalog: active,
  };
}

export function buildProductInsertFromSnapshot(
  snapshot: ApprovedCatalogueProductSnapshot,
): Record<string, unknown> {
  const patch = buildProductPatchFromSnapshot(snapshot);
  return {
    ...patch,
    primary_pack_weight_kg:
      snapshot.avg_weight_per_pack && snapshot.avg_weight_per_pack > 0
        ? snapshot.avg_weight_per_pack
        : snapshot.net_weight_grams && snapshot.net_weight_grams > 0
          ? snapshot.net_weight_grams / 1000
          : 0.001,
    moq: 1,
  };
}
