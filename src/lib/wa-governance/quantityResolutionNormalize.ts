import { convertToKgFromCatalogue } from "@/lib/unit-conversion";
import { getProductCategory } from "@/utils/pricing";

export interface CatalogueQuantityProduct {
  weight_per_box_kg?: number | null;
  grams_per_piece?: number | null;
  category?: string | null;
  sub_category?: string | null;
  uom?: string | null;
  packs_per_master_carton?: number | null;
  packs_per_carton?: number | null;
  pcs_per_master_carton?: number | null;
  settlement_unit?: string | null;
}

export interface CatalogueNormalizedQuantity {
  normalizedValue: number;
  normalizedUnit: string;
  normalizationReason: string;
}

function cataloguePacksPerCarton(product: CatalogueQuantityProduct): number | null {
  const cat = getProductCategory(product);
  switch (cat) {
    case "bulk_kg": {
      const count = product.packs_per_master_carton ?? product.packs_per_carton ?? null;
      return count != null && count > 0 ? count : null;
    }
    case "ready_pc":
    case "premium_pc": {
      const count = product.pcs_per_master_carton ?? product.packs_per_master_carton ?? null;
      return count != null && count > 0 ? count : null;
    }
  }
}

function innerUnitLabel(product: CatalogueQuantityProduct): "packs" | "pcs" {
  return getProductCategory(product) === "bulk_kg" ? "packs" : "pcs";
}

function isCartonUnit(unit: string | null): boolean {
  if (!unit) return false;
  const normalized = unit.toLowerCase();
  return normalized === "carton" || normalized === "cartons" || normalized === "ctn" || normalized === "ctns";
}

/**
 * Normalize a parsed message quantity using authoritative catalogue fields only.
 * Returns null when no catalogue-backed conversion exists (caller keeps raw quantity).
 */
export function normalizeQuantityFromCatalogue(
  value: number,
  unit: string | null,
  product: CatalogueQuantityProduct | null | undefined,
): CatalogueNormalizedQuantity | null {
  if (!product || !Number.isFinite(value) || value <= 0) return null;

  if (isCartonUnit(unit)) {
    const perCarton = cataloguePacksPerCarton(product);
    if (perCarton == null) return null;
    const innerUnit = innerUnitLabel(product);
    return {
      normalizedValue: value * perCarton,
      normalizedUnit: innerUnit,
      normalizationReason: `Catalogue packs per carton (${perCarton}) converts ${value} cartons to ${value * perCarton} ${innerUnit}`,
    };
  }

  const kg = convertToKgFromCatalogue(value, unit, product);
  if (kg == null) return null;

  return {
    normalizedValue: kg,
    normalizedUnit: "kg",
    normalizationReason: `Catalogue weight profile converts ${value}${unit ? ` ${unit}` : ""} to ${kg} kg`,
  };
}
