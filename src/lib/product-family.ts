/**
 * Product Family resolver — single source of truth for category-aware UI.
 *
 * Families:
 *   - bulk_sweets   → sweets sold by weight (kg/box). Show: weight per pc, pcs per kg.
 *   - retail_pack   → packaged sweets. Show: pack weight, MRP per pack.
 *   - goldware      → trays, baskets, platters. Show: dimensions, material. Hide weight.
 *   - hampers       → gift packs / bundles. Show: BOM summary, gross weight.
 */

export type ProductFamily = "bulk_sweets" | "retail_pack" | "goldware" | "hampers";

export const FAMILY_OPTIONS: { value: ProductFamily; label: string }[] = [
  { value: "bulk_sweets", label: "Bulk Sweets" },
  { value: "retail_pack", label: "Retail Pack" },
  { value: "goldware", label: "Goldware / Packaging" },
  { value: "hampers", label: "Hamper / Gift Pack" },
];

/** Resolve family from explicit field, falling back to category text. */
export function resolveProductFamily(p: {
  product_family?: string | null;
  category?: string | null;
}): ProductFamily {
  const explicit = (p.product_family || "").toLowerCase().trim();
  if (explicit === "bulk_sweets" || explicit === "retail_pack" || explicit === "goldware" || explicit === "hampers") {
    return explicit;
  }
  const cat = (p.category || "").toLowerCase();
  if (cat.includes("hamper") || cat.includes("gift")) return "hampers";
  if (cat.includes("goldware") || cat.includes("packaging") || cat.includes("platter") || cat.includes("basket") || cat.includes("tray")) return "goldware";
  if (cat.includes("bulk")) return "bulk_sweets";
  return "retail_pack";
}

/** Should the UI hide kg-based weight chips for this family? */
export function familyHidesWeight(f: ProductFamily): boolean {
  return f === "goldware";
}

/** Human-friendly scale label shown on product cards / detail. */
export function getDisplayScale(p: {
  product_family?: string | null;
  category?: string | null;
  dimensions?: string | null;
  material?: string | null;
  gross_weight_kg?: number | null;
  net_weight_grams?: number | null;
  weight_per_pc_grams?: number | null;
  pack_size?: string | null;
}): string | null {
  const fam = resolveProductFamily(p);

  if (fam === "goldware") {
    const parts = [p.dimensions, p.material].filter(Boolean) as string[];
    if (parts.length) return parts.join(" · ");
    return p.pack_size || "1 Unit";
  }

  if (fam === "hampers") {
    if (p.gross_weight_kg && Number(p.gross_weight_kg) > 0) {
      return `Gross ${Number(p.gross_weight_kg)} kg`;
    }
    return "1 Hamper";
  }

  // Food families — keep weight if available.
  const net = Number(p.net_weight_grams) || 0;
  if (net > 0) return net >= 1000 ? `${(net / 1000).toFixed(2).replace(/\.00$/, "")} kg` : `${net} g`;
  return p.pack_size || null;
}
