import { convertToKgFromCatalogueWithSource } from "@/lib/unit-conversion";
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

export interface CatalogueQuantityConversion {
  normalizedQuantity: number;
  normalizedUnit: string;
  conversionSource: string;
}

function catalogueCartonInnerCount(
  product: CatalogueQuantityProduct,
): { count: number; conversionSource: string; normalizedUnit: "packs" | "pcs" } | null {
  const cat = getProductCategory(product);
  switch (cat) {
    case "bulk_kg": {
      if (product.packs_per_master_carton != null && product.packs_per_master_carton > 0) {
        return {
          count: product.packs_per_master_carton,
          conversionSource: "products.packs_per_master_carton",
          normalizedUnit: "packs",
        };
      }
      if (product.packs_per_carton != null && product.packs_per_carton > 0) {
        return {
          count: product.packs_per_carton,
          conversionSource: "products.packs_per_carton",
          normalizedUnit: "packs",
        };
      }
      return null;
    }
    case "ready_pc":
    case "premium_pc": {
      if (product.pcs_per_master_carton != null && product.pcs_per_master_carton > 0) {
        return {
          count: product.pcs_per_master_carton,
          conversionSource: "products.pcs_per_master_carton",
          normalizedUnit: "pcs",
        };
      }
      if (product.packs_per_master_carton != null && product.packs_per_master_carton > 0) {
        return {
          count: product.packs_per_master_carton,
          conversionSource: "products.packs_per_master_carton",
          normalizedUnit: "pcs",
        };
      }
      return null;
    }
  }
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
  rawQuantity: number,
  rawUnit: string | null,
  product: CatalogueQuantityProduct | null | undefined,
): CatalogueQuantityConversion | null {
  if (!product || !Number.isFinite(rawQuantity) || rawQuantity <= 0) return null;

  if (isCartonUnit(rawUnit)) {
    const carton = catalogueCartonInnerCount(product);
    if (carton == null) return null;
    return {
      normalizedQuantity: rawQuantity * carton.count,
      normalizedUnit: carton.normalizedUnit,
      conversionSource: carton.conversionSource,
    };
  }

  const kgConversion = convertToKgFromCatalogueWithSource(rawQuantity, rawUnit, product);
  if (kgConversion == null) return null;

  return {
    normalizedQuantity: kgConversion.normalizedQuantity,
    normalizedUnit: kgConversion.normalizedUnit,
    conversionSource: kgConversion.conversionSource,
  };
}
