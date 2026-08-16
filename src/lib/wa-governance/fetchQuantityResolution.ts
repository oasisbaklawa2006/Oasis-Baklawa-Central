import type { SupabaseClient } from "@supabase/supabase-js";
import { extractQuantityResolutionTextSignals } from "./quantityResolutionSignals";
import {
  isCartonEquivalentUnit,
  isCatalogueCartonInnerCountConversion,
  normalizeQuantityFromCatalogue,
  shouldApplyCatalogueConversionToEntry,
  type CatalogueQuantityProduct,
} from "./quantityResolutionNormalize";
import { scoreQuantityResolutionCandidates } from "./quantityResolutionScoring";
import type {
  QuantityResolutionEntry,
  QuantityResolutionInput,
  QuantityResolutionResult,
  QuantityResolutionTextSignals,
} from "./quantityResolutionTypes";

const CATALOGUE_QUANTITY_SELECT =
  "id, weight_per_box_kg, grams_per_piece, category, sub_category, uom, packs_per_master_carton, packs_per_carton, pcs_per_master_carton, settlement_unit";
const DIRECT_WEIGHT_WITH_PRODUCT = /^\s*\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|gm|gms|grams?|g)[ \t]+/i;

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function directProductHintMatchesCatalogue(productHint: string | null, productName: string): boolean {
  if (!productHint?.trim() || !productName.trim()) return false;
  const hintWords = normalizeWords(productHint);
  const productWords = new Set(normalizeWords(productName));
  if (hintWords.length === 0 || productWords.size === 0) return false;
  return hintWords.some((word) => productWords.has(word));
}

function requireCatalogueBackingForDirectWeights(
  signals: QuantityResolutionTextSignals,
  productBestMatchName: string | null | undefined,
): QuantityResolutionTextSignals {
  return {
    ...signals,
    matches: signals.matches.filter((match) => {
      if (!DIRECT_WEIGHT_WITH_PRODUCT.test(match.rawText)) return true;
      if (!productBestMatchName) return false;
      return directProductHintMatchesCatalogue(match.productHint, productBestMatchName);
    }),
  };
}

function entryWithoutCatalogueNormalization(
  entry: QuantityResolutionEntry,
): QuantityResolutionEntry {
  return {
    ...entry,
    conversionStatus: "unknown",
    normalizedQuantity: undefined,
    normalizedUnit: undefined,
    conversionSource: undefined,
  };
}

export async function fetchCatalogueQuantityProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<CatalogueQuantityProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select(CATALOGUE_QUANTITY_SELECT)
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as CatalogueQuantityProduct;
}

export function applyCatalogueConversionToEntry(
  entry: QuantityResolutionEntry,
  product: CatalogueQuantityProduct | null | undefined,
): QuantityResolutionEntry {
  const conversion = normalizeQuantityFromCatalogue(
    entry.rawQuantity,
    entry.rawUnit,
    product,
  );
  if (!conversion) {
    return entryWithoutCatalogueNormalization(entry);
  }

  if (
    isCatalogueCartonInnerCountConversion(conversion.conversionSource) &&
    !isCartonEquivalentUnit(entry.rawUnit)
  ) {
    return entryWithoutCatalogueNormalization(entry);
  }

  return {
    ...entry,
    normalizedQuantity: conversion.normalizedQuantity,
    normalizedUnit: conversion.normalizedUnit,
    conversionSource: conversion.conversionSource,
    conversionStatus: "resolved",
    reasons: [
      ...entry.reasons,
      `Catalogue conversion via ${conversion.conversionSource}: ${entry.rawQuantity}${entry.rawUnit ? ` ${entry.rawUnit}` : ""} → ${conversion.normalizedQuantity} ${conversion.normalizedUnit}`,
    ],
  };
}

function applyCatalogueNormalization(
  result: QuantityResolutionResult,
  product: CatalogueQuantityProduct | null,
  productBestMatchName?: string | null,
): QuantityResolutionResult {
  const quantities = result.quantities.map((entry) => {
    if (
      !shouldApplyCatalogueConversionToEntry(
        entry,
        productBestMatchName,
        result.quantities.length,
      )
    ) {
      return entryWithoutCatalogueNormalization(entry);
    }
    return applyCatalogueConversionToEntry(entry, product);
  });
  return { ...result, quantities };
}

/**
 * Read-only quantity resolution for operator inbox (WA-06A).
 * Message parsing plus optional SELECT on products for catalogue normalization.
 */
export async function resolveQuantityCandidates(
  input: QuantityResolutionInput,
  supabase?: SupabaseClient | null,
  catalogueProduct?: CatalogueQuantityProduct | null,
): Promise<QuantityResolutionResult> {
  const rawSignals = extractQuantityResolutionTextSignals(
    input.messageText,
    input.stitchedPlainText,
  );
  const signals = requireCatalogueBackingForDirectWeights(rawSignals, input.productBestMatchName);
  const scored = scoreQuantityResolutionCandidates({ signals });

  if (catalogueProduct !== undefined) {
    return applyCatalogueNormalization(scored, catalogueProduct, input.productBestMatchName);
  }

  if (!input.productId || !supabase) {
    return scored;
  }

  const product = await fetchCatalogueQuantityProduct(supabase, input.productId);
  return applyCatalogueNormalization(scored, product, input.productBestMatchName);
}

export async function fetchQuantityResolution(
  supabase: SupabaseClient | null,
  input: QuantityResolutionInput,
): Promise<QuantityResolutionResult> {
  return resolveQuantityCandidates(input, supabase);
}
