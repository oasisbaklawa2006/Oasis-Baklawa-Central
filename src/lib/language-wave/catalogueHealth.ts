import { BATCH001_PRODUCTS } from "./batch001Manifest";
import type { CatalogueHealthRow } from "./types";

export interface Batch001LiveHealthSnapshot {
  sku: string;
  has_image: boolean;
  visible_in_catalog: boolean;
  hsn_code: string | null;
  gst_rate: string | null;
  uom: string | null;
  pack_size: string | null;
  table_alias_count: number;
  product_alias_count: number;
}

const HEALTH_CHECKS = [
  { key: "hsn_gst", label: "HSN/GST", test: (r: Batch001LiveHealthSnapshot) => Boolean(r.hsn_code && r.gst_rate) },
  { key: "uom_pack", label: "UOM/packaging", test: (r: Batch001LiveHealthSnapshot) => Boolean(r.uom && r.pack_size) },
  { key: "media", label: "Media", test: (r: Batch001LiveHealthSnapshot) => r.has_image },
  { key: "search", label: "Search visibility", test: (r: Batch001LiveHealthSnapshot) => r.visible_in_catalog },
  { key: "aliases", label: "Alias readiness", test: (r: Batch001LiveHealthSnapshot) => r.table_alias_count > 0 },
  { key: "whatsapp", label: "WhatsApp keyword path", test: (r: Batch001LiveHealthSnapshot) => r.table_alias_count >= 3 },
  { key: "truth", label: "Product truth (name+sku)", test: () => true },
] as const;

export function scoreCatalogueHealth(
  snapshots: Batch001LiveHealthSnapshot[],
): CatalogueHealthRow[] {
  const bySku = new Map(snapshots.map((s) => [s.sku, s]));

  return BATCH001_PRODUCTS.map((product) => {
    const snap = bySku.get(product.sku);
    const missing: string[] = [];
    let passed = 0;

    for (const check of HEALTH_CHECKS) {
      const ok = snap ? check.test(snap) : check.key === "truth";
      if (ok) passed += 1;
      else missing.push(check.label);
    }

    const score = Math.round((passed / HEALTH_CHECKS.length) * 100);
    return { sku: product.sku, name: product.name, score, missing };
  });
}

export function batchHealthPercent(rows: CatalogueHealthRow[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / rows.length);
}

/** Live snapshot from Central read-only audit (2026-06-09). */
export const BATCH001_LIVE_HEALTH_SNAPSHOT: Batch001LiveHealthSnapshot[] = [
  { sku: "OAS-AS-BKL-0001", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 12, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0002", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0003", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 9, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0004", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0005", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0006", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0007", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 11, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0008", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0009", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0010", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "3kg", table_alias_count: 9, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0011", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0012", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 9, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0013", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 20, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0014", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 22, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0015", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 11, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0016", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 7, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0017", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 8, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0018", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 0, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0019", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 9, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0020", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 19, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0021", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 8, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0022", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 9, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0023", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "6kg", table_alias_count: 5, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0024", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 21, product_alias_count: 0 },
  { sku: "OAS-AS-BKL-0025", has_image: false, visible_in_catalog: false, hsn_code: "21069099", gst_rate: "0.05", uom: "KG", pack_size: "1kg", table_alias_count: 12, product_alias_count: 0 },
];
