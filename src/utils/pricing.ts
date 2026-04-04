/**
 * Global B2B pricing utility.
 *
 * Three category pathways determined by product.uom:
 *
 * Category 1 – Bulk Sweets & Nuts (UOM: "Kg")
 *   Display Price  = base_price_per_kg  (₹/kg)
 *   Pack Price     = base_price_per_kg * primary_pack_weight_kg
 *   Qty stepper    = starts at moq, increments by 1 pack
 *   Sealed carton  = qty % packs_per_master_carton === 0
 *
 * Category 2 – Ready Packs (UOM: "Pc")
 *   Display Price  = base_price_per_pc
 *   Qty stepper    = starts at moq, increments by moq block
 *   Sealed carton  = qty % pcs_per_master_carton === 0
 *
 * Category 3 – Premium Luxury Gifts (UOM: "Pc", category contains "Premium" or "Luxury" or "Gift")
 *   Display Price  = base_price_per_pc
 *   Qty stepper    = starts at 1 full carton (or 2 if capacity ≤ 2), increments by full cartons only
 *   No mixing allowed
 *
 * Field mappings (DB → logic):
 *   primary_pack_weight_kg = avg_weight_per_pack (stored in kg)
 *                            fallback: net_weight_grams / 1000
 *   gst_rate               = gst_percentage
 *   base_price_per_kg      = price_per_kg || wholesale_price || base_price
 *   base_price_per_pc      = mrp_per_pc || base_price || wholesale_price
 */

// ── Category detection ──────────────────────────────────────────────

export type ProductCategory = "bulk_kg" | "ready_pc" | "premium_pc";

const PREMIUM_KEYWORDS = ["premium", "luxury", "gift"];

export function getProductCategory(product: any): ProductCategory {
  const uom = (product?.uom || "Pack").toLowerCase();
  const category = (product?.category || "").toLowerCase();
  const subCategory = (product?.sub_category || "").toLowerCase();

  if (uom === "kg") return "bulk_kg";

  // Check if premium/luxury/gift
  const combined = `${category} ${subCategory}`;
  if (PREMIUM_KEYWORDS.some((kw) => combined.includes(kw))) return "premium_pc";

  return "ready_pc";
}

// ── Weight helpers ──────────────────────────────────────────────────

export function getPrimaryPackWeightKg(product: any): number {
  if (product?.avg_weight_per_pack && product.avg_weight_per_pack > 0) {
    return product.avg_weight_per_pack;
  }
  if (product?.net_weight_grams && product.net_weight_grams > 0) {
    return product.net_weight_grams / 1000;
  }
  return 0;
}

// ── Tiered pricing engine ────────────────────────────────────────────

/**
 * Returns the correct price for a product based on the company's price tier.
 * Tier mapping:
 *   Bulk       → price_bulk
 *   Wholesale  → price_wholesale
 *   HoReCa     → price_horeca
 *   B2B        → price_b2b
 *   Special    → price_special
 *   MRP/Retail → mrp (or mrp_per_pc)
 *
 * Fallback chain: tier price → price_b2b → price_wholesale → price_per_kg → base_price → mrp → 0
 */
export function getTieredPricePerKg(product: any, priceTier?: string | null): number {
  const mrp = Number(product?.mrp) || 0;
  const tier = (priceTier || "").toLowerCase();

  // 1. Calculated Tiers (Requires MRP)
  if (tier.includes("bulk") && mrp > 0) return mrp * 0.80;
  if (tier.includes("wholesale") && mrp > 0) return mrp * 0.70;

  // 2. Database Column Tiers
  if (tier.includes("horeca") && Number(product?.price_horeca) > 0) return Number(product.price_horeca);
  if (tier.includes("special") && Number(product?.price_special) > 0) return Number(product.price_special);
  if (tier.includes("b2b")) {
    const b2b = Number(product?.price_b2b) || Number(product?.base_price) || Number(product?.price_per_kg) || 0;
    if (b2b > 0) return b2b;
  }

  // 3. Ultimate Fallbacks
  if (mrp > 0) return mrp;
  return Number(product?.price_b2b) || Number(product?.price_per_kg) || Number(product?.base_price) || 0;
}

export function getTieredPricePerPc(product: any, priceTier?: string | null): number {
  const mrp = Number(product?.mrp_per_pc) || Number(product?.mrp) || 0;
  const tier = (priceTier || "").toLowerCase();

  // 1. Calculated Tiers
  if (tier.includes("bulk") && mrp > 0) return mrp * 0.80;
  if (tier.includes("wholesale") && mrp > 0) return mrp * 0.70;

  // 2. Database Column Tiers
  if (tier.includes("horeca") && Number(product?.price_horeca) > 0) return Number(product.price_horeca);
  if (tier.includes("special") && Number(product?.price_special) > 0) return Number(product.price_special);
  if (tier.includes("b2b")) {
    const b2b = Number(product?.price_b2b) || Number(product?.base_price) || Number(product?.price_per_kg) || 0;
    if (b2b > 0) return b2b;
  }

  // 3. Ultimate Fallbacks
  if (mrp > 0) return mrp;
  return Number(product?.price_b2b) || Number(product?.base_price) || 0;
}

function resolveTierColumn(product: any, priceTier?: string | null, _mode?: string): number | null {
  if (!priceTier || !product) return null;
  const tier = priceTier.toLowerCase().replace(/\s+/g, "_");
  const mapping: Record<string, string[]> = {
    bulk: ["price_bulk"],
    wholesale: ["price_wholesale", "wholesale_price"],
    horeca: ["price_horeca"],
    b2b: ["price_b2b"],
    special: ["price_special"],
    mrp: ["mrp", "mrp_per_pc"],
    retail: ["mrp", "mrp_per_pc"],
  };
  const columns = mapping[tier];
  if (!columns) return null;
  for (const col of columns) {
    const val = product[col];
    if (val != null && Number(val) > 0) return Number(val);
  }
  return null;
}

// ── Base price helpers (legacy, no tier) ────────────────────────────

export function getBasePricePerKg(product: any): number {
  return getTieredPricePerKg(product);
}

export function getBasePricePerPc(product: any): number {
  return getTieredPricePerPc(product);
}

// ── Display price (what appears on catalogue cards) ─────────────────

export function getDisplayPrice(product: any, priceTier?: string | null): { price: number; unit: string } {
  const cat = getProductCategory(product);

  switch (cat) {
    case "bulk_kg":
      return { price: getTieredPricePerKg(product, priceTier), unit: "/kg" };
    case "ready_pc":
    case "premium_pc":
      return { price: getTieredPricePerPc(product, priceTier), unit: "/pc" };
  }
}

// ── Pack / unit price (price of one orderable unit) ─────────────────

export function calculatePackPrice(product: any, priceTier?: string | null): number {
  const cat = getProductCategory(product);

  switch (cat) {
    case "bulk_kg": {
      const perKg = getTieredPricePerKg(product, priceTier);
      const weightKg = getPrimaryPackWeightKg(product);
      if (perKg > 0 && weightKg > 0) return perKg * weightKg;
      return product?.mrp || perKg || 0;
    }
    case "ready_pc":
    case "premium_pc":
      return getTieredPricePerPc(product, priceTier);
  }
}

// ── Line total (before tax) ─────────────────────────────────────────

export function calculateLineTotal(product: any, quantity: number, priceTier?: string | null): number {
  return calculatePackPrice(product, priceTier) * quantity;
}

// ── GST per line item ───────────────────────────────────────────────

export function getGstRate(product: any): number {
  return product?.gst_percentage ?? 0;
}

export function calculateLineTax(product: any, quantity: number, priceTier?: string | null): number {
  const lineTotal = calculateLineTotal(product, quantity, priceTier);
  const rate = getGstRate(product);
  return lineTotal * (rate / 100);
}

export function calculateLineGrandTotal(product: any, quantity: number, priceTier?: string | null): number {
  return calculateLineTotal(product, quantity, priceTier) + calculateLineTax(product, quantity, priceTier);
}

// ── Carton / packing helpers ────────────────────────────────────────

export function getPacksPerCarton(product: any): number {
  const cat = getProductCategory(product);
  switch (cat) {
    case "bulk_kg":
      return product?.packs_per_master_carton || product?.packs_per_carton || 1;
    case "ready_pc":
      return product?.pcs_per_master_carton || product?.packs_per_master_carton || 1;
    case "premium_pc":
      return product?.pcs_per_master_carton || product?.packs_per_master_carton || 1;
  }
}

export function calculateCartonPrice(product: any, priceTier?: string | null): number {
  return calculatePackPrice(product, priceTier) * getPacksPerCarton(product);
}

// ── MOQ / Qty stepper logic ─────────────────────────────────────────

export function getMinOrderQty(product: any): number {
  const cat = getProductCategory(product);
  const rawMoq = product?.moq ?? 0;
  // Safeguard: if MOQ is 0 or negative, treat as 1
  const moq = rawMoq > 0 ? rawMoq : 1;

  switch (cat) {
    case "bulk_kg":
      return moq;
    case "ready_pc":
      return moq;
    case "premium_pc": {
      const perCarton = getPacksPerCarton(product);
      return perCarton <= 2 ? perCarton * 2 : perCarton;
    }
  }
}

export function getQtyIncrement(product: any): number {
  const cat = getProductCategory(product);
  switch (cat) {
    case "bulk_kg":
      return 1;
    case "ready_pc":
      return product?.moq || 1;
    case "premium_pc":
      return getPacksPerCarton(product);
  }
}

// ── Sealed carton validation ────────────────────────────────────────

export function isCartonSealed(product: any, quantity: number): boolean {
  const perCarton = getPacksPerCarton(product);
  if (perCarton <= 0) return true;
  return quantity % perCarton === 0;
}

export function unitsToFillCarton(product: any, quantity: number): number {
  const perCarton = getPacksPerCarton(product);
  if (perCarton <= 0) return 0;
  const remainder = quantity % perCarton;
  return remainder === 0 ? 0 : perCarton - remainder;
}

// ── Pack description for UI ──────────────────────────────────────────

export function getPackDescription(product: any): string {
  const cat = getProductCategory(product);

  if (cat === "bulk_kg") {
    const weightKg = getPrimaryPackWeightKg(product);
    if (weightKg > 0) {
      return weightKg >= 1
        ? `Box: ${weightKg} kg`
        : `Box: ${Math.round(weightKg * 1000)} g`;
    }
    return "Box: 1 unit";
  }

  // ready_pc / premium_pc
  const increment = getQtyIncrement(product);
  return `Pack Size: ${increment} pc`;
}

// ── HSN code helper ─────────────────────────────────────────────────

export function getHsnCode(product: any): string {
  return product?.hsn_code || "";
}
