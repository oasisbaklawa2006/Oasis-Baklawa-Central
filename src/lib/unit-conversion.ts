/**
 * Catalogue-Driven Unit Conversion Engine.
 *
 * Resolves a quantity + unit (kg / box / pcs / carton / gm) to total kilograms,
 * using per-SKU values from the products table when available.
 *
 * Fallbacks (only when product fields are null AND the SKU appears to be a
 * Bulk item — caller decides whether to apply Bulk defaults):
 *   - 1 box  = 6 kg
 *   - 1 pc   = 22 g (0.022 kg)
 */

export const BULK_DEFAULT_BOX_KG = 6;
export const BULK_DEFAULT_GRAMS_PER_PIECE = 22;

export interface WeightProfile {
  weight_per_box_kg?: number | null;
  grams_per_piece?: number | null;
  category?: string | null;
}

export type UnitToken =
  | "kg"
  | "gm"
  | "pcs"
  | "box"
  | "carton"
  | "unit"
  | null
  | undefined;

/** Normalise raw user-typed unit strings into a canonical token. */
export function normalizeUnit(raw: string | null | undefined): UnitToken {
  if (!raw) return null;
  const u = raw.toLowerCase().trim();
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["gm", "g", "gms", "gram", "grams"].includes(u)) return "gm";
  if (["pc", "pcs", "piece", "pieces"].includes(u)) return "pcs";
  if (["box", "boxes"].includes(u)) return "box";
  if (["carton", "cartons", "ctn", "ctns"].includes(u)) return "carton";
  if (["tin", "tins", "tray", "trays", "pack", "packs"].includes(u)) return "box";
  if (["unit", "units"].includes(u)) return "unit";
  return null;
}

/**
 * Convert using catalogue fields only — no bulk defaults, no inferred pack sizes.
 * Returns null when authoritative product data is missing.
 */
export function convertToKgFromCatalogueWithSource(
  quantity: number,
  rawUnit: string | null | undefined,
  product: WeightProfile,
): { normalizedQuantity: number; normalizedUnit: "kg"; conversionSource: string } | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unit = normalizeUnit(rawUnit);
  const boxKg =
    product.weight_per_box_kg != null && product.weight_per_box_kg > 0
      ? product.weight_per_box_kg
      : null;
  const gramsPerPiece =
    product.grams_per_piece != null && product.grams_per_piece > 0
      ? product.grams_per_piece
      : null;

  switch (unit) {
    case "kg":
      return {
        normalizedQuantity: quantity,
        normalizedUnit: "kg",
        conversionSource: "catalogue.kg_identity",
      };
    case "gm":
      return {
        normalizedQuantity: quantity / 1000,
        normalizedUnit: "kg",
        conversionSource: "catalogue.gm_to_kg",
      };
    case "box":
    case "carton":
      return boxKg != null
        ? {
            normalizedQuantity: quantity * boxKg,
            normalizedUnit: "kg",
            conversionSource: "products.weight_per_box_kg",
          }
        : null;
    case "pcs":
    case "unit":
      return gramsPerPiece != null
        ? {
            normalizedQuantity: (quantity * gramsPerPiece) / 1000,
            normalizedUnit: "kg",
            conversionSource: "products.grams_per_piece",
          }
        : null;
    default:
      return null;
  }
}

export function convertToKgFromCatalogue(
  quantity: number,
  rawUnit: string | null | undefined,
  product: WeightProfile,
): number | null {
  return convertToKgFromCatalogueWithSource(quantity, rawUnit, product)?.normalizedQuantity ?? null;
}

/**
 * Convert a quantity in any unit to kilograms using the SKU's catalogue weights.
 * Returns null if the conversion cannot be made confidently.
 */
export function convertToKg(
  quantity: number,
  rawUnit: string | null | undefined,
  product: WeightProfile,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unit = normalizeUnit(rawUnit);
  const isBulk = (product.category || "").toLowerCase().includes("bulk");

  // Catalogue weights — fallback only for Bulk items.
  const boxKg =
    product.weight_per_box_kg ??
    (isBulk ? BULK_DEFAULT_BOX_KG : null);
  const gramsPerPiece =
    product.grams_per_piece ??
    (isBulk ? BULK_DEFAULT_GRAMS_PER_PIECE : null);

  switch (unit) {
    case "kg":
      return quantity;
    case "gm":
      return quantity / 1000;
    case "box":
    case "carton":
      return boxKg ? quantity * boxKg : null;
    case "pcs":
    case "unit":
      return gramsPerPiece ? (quantity * gramsPerPiece) / 1000 : null;
    default:
      // Bare number with no unit — assume Kg only for Bulk; else unknown.
      return isBulk ? quantity : null;
  }
}
