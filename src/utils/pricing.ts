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

// ── Tiered pricing helper ────────────────────────────────────────────

/**
 * Maps a company's price_tier to the correct product price column.
 * Falls through to the base price if the tier-specific column is empty.
 */
export type PriceTier = "bulk" | "wholesale" | "horeca" | "b2b" | "special" | "private_label" | string;

const TIER_MAP: Record<string, (p: any) => number | null> = {
  bulk:          (p) => p?.price_bulk,
  wholesale:     (p) => p?.price_wholesale,
  horeca:        (p) => p?.price_horeca,
  b2b:           (p) => p?.price_b2b,
  special:       (p) => p?.price_special,
  private_label: (p) => p?.private_label_price,
};

function normalizeTierKey(tier: string | null | undefined): string {
  if (!tier) return "b2b";
  const lower = tier.toLowerCase();
  if (lower.includes("bulk")) return "bulk";
  if (lower.includes("wholesale")) return "wholesale";
  if (lower.includes("horeca")) return "horeca";
  if (lower.includes("special")) return "special";
  if (lower.includes("private")) return "private_label";
  return "b2b";
}

export function calculateTieredPrice(product: any, priceTier?: string | null): number {
  const key = normalizeTierKey(priceTier);
  const getter = TIER_MAP[key];
  const tieredPrice = getter?.(product);
  if (tieredPrice && tieredPrice > 0) return tieredPrice;
  // Fallback chain
  return product?.price_b2b || product?.price_wholesale || product?.price_per_kg || product?.base_price || 0;
}

// ── Base price helpers ──────────────────────────────────────────────

export function getBasePricePerKg(product: any, priceTier?: string | null): number {
  const tiered = calculateTieredPrice(product, priceTier);
  if (tiered > 0) return tiered;
  return product?.price_per_kg || product?.wholesale_price || product?.base_price || 0;
}

export function getBasePricePerPc(product: any, priceTier?: string | null): number {
  const tiered = calculateTieredPrice(product, priceTier);
  if (tiered > 0) return tiered;
  return product?.mrp_per_pc || product?.base_price || product?.wholesale_price || product?.price_per_kg || 0;
}

// ── Display price (what appears on catalogue cards) ─────────────────

export function getDisplayPrice(product: any, priceTier?: string | null): { price: number; unit: string } {
  const cat = getProductCategory(product);

  switch (cat) {
    case "bulk_kg":
      return { price: getBasePricePerKg(product, priceTier), unit: "/kg" };
    case "ready_pc":
    case "premium_pc":
      return { price: getBasePricePerPc(product, priceTier), unit: "/pc" };
  }
}

// ── Pack / unit price (price of one orderable unit) ─────────────────

export function calculatePackPrice(product: any, priceTier?: string | null): number {
  const cat = getProductCategory(product);

  switch (cat) {
    case "bulk_kg": {
      const perKg = getBasePricePerKg(product, priceTier);
      const weightKg = getPrimaryPackWeightKg(product);
      if (perKg > 0 && weightKg > 0) return perKg * weightKg;
      return product?.mrp || perKg || 0;
    }
    case "ready_pc":
    case "premium_pc":
      return getBasePricePerPc(product, priceTier);
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

export function calculateCartonPrice(product: any): number {
  return calculatePackPrice(product) * getPacksPerCarton(product);
}

// ── MOQ / Qty stepper logic ─────────────────────────────────────────

export function getMinOrderQty(product: any): number {
  const cat = getProductCategory(product);
  const moq = product?.moq || 1;

  switch (cat) {
    case "bulk_kg":
      return moq; // starts at moq, increments by 1
    case "ready_pc":
      return moq; // starts at moq, increments by moq
    case "premium_pc": {
      const perCarton = getPacksPerCarton(product);
      // Min 1 full carton, or 2 if capacity ≤ 2
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

// ── HSN code helper ─────────────────────────────────────────────────

export function getHsnCode(product: any): string {
  return product?.hsn_code || "";
}
