import { convertToKgFromCatalogueWithSource } from "@/lib/unit-conversion";
import {
  aliasesMatchForIdentity,
  extractIdentityKeywordHits,
  isIdentityAlias,
  keywordMatchesIdentityAlias,
} from "./productResolutionAliasPolicy";
import { getProductCategory } from "@/utils/pricing";
import type { QuantityResolutionEntry } from "./quantityResolutionTypes";

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

function isCartonEquivalentUnit(unit: string | null): boolean {
  if (!unit) return false;
  const normalized = unit.toLowerCase();
  return (
    normalized === "carton" ||
    normalized === "cartons" ||
    normalized === "ctn" ||
    normalized === "ctns" ||
    normalized === "case" ||
    normalized === "cases"
  );
}

function productHintMatchesBestMatchIdentity(
  productHint: string,
  productBestMatchName: string,
): boolean {
  if (!isIdentityAlias(productHint)) return false;
  if (keywordMatchesIdentityAlias(productHint, productBestMatchName)) return true;

  return extractIdentityKeywordHits(productBestMatchName).some(
    (identityHit) =>
      aliasesMatchForIdentity(productHint, identityHit) ||
      keywordMatchesIdentityAlias(productHint, identityHit) ||
      keywordMatchesIdentityAlias(identityHit, productHint),
  );
}

/**
 * Gate catalogue normalization per quantity line against the product best match.
 * A. Single quantity + product profile → allowed.
 * B. Multiple quantities + productHint matches best-match via WA-05A identity policy → allowed.
 * C. Otherwise → do not apply catalogue conversion.
 */
export function shouldApplyCatalogueConversionToEntry(
  entry: QuantityResolutionEntry,
  productBestMatchName: string | null | undefined,
  totalQuantities: number,
): boolean {
  if (!productBestMatchName?.trim()) return false;
  if (totalQuantities === 1) return true;
  if (!entry.productHint?.trim()) return false;

  return productHintMatchesBestMatchIdentity(entry.productHint, productBestMatchName);
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

  if (isCartonEquivalentUnit(rawUnit)) {
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
