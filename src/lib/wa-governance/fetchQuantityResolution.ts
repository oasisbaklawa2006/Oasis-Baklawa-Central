import type { SupabaseClient } from "@supabase/supabase-js";
import { extractQuantityResolutionTextSignals } from "./quantityResolutionSignals";
import {
  normalizeQuantityFromCatalogue,
  type CatalogueQuantityProduct,
} from "./quantityResolutionNormalize";
import { scoreQuantityResolutionCandidates } from "./quantityResolutionScoring";
import type { QuantityResolutionInput, QuantityResolutionResult } from "./quantityResolutionTypes";

const CATALOGUE_QUANTITY_SELECT =
  "id, weight_per_box_kg, grams_per_piece, category, sub_category, uom, packs_per_master_carton, packs_per_carton, pcs_per_master_carton, settlement_unit";

async function fetchCatalogueQuantityProduct(
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

function applyCatalogueNormalization(
  result: QuantityResolutionResult,
  product: CatalogueQuantityProduct | null,
): QuantityResolutionResult {
  if (!product) return result;

  const quantities = result.quantities.map((entry) => {
    const normalized = normalizeQuantityFromCatalogue(entry.value, entry.unit, product);
    if (!normalized) return entry;
    return {
      ...entry,
      normalizedValue: normalized.normalizedValue,
      normalizedUnit: normalized.normalizedUnit,
      normalizationReason: normalized.normalizationReason,
      reasons: [...entry.reasons, normalized.normalizationReason],
    };
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
): Promise<QuantityResolutionResult> {
  const signals = extractQuantityResolutionTextSignals(
    input.messageText,
    input.stitchedPlainText,
  );
  const scored = scoreQuantityResolutionCandidates({ signals });

  if (!input.productId || !supabase) {
    return scored;
  }

  const product = await fetchCatalogueQuantityProduct(supabase, input.productId);
  return applyCatalogueNormalization(scored, product);
}

export async function fetchQuantityResolution(
  supabase: SupabaseClient | null,
  input: QuantityResolutionInput,
): Promise<QuantityResolutionResult> {
  return resolveQuantityCandidates(input, supabase);
}
