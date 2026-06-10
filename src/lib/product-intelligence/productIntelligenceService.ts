import type { SupabaseClient } from "@supabase/supabase-js";
import { loadApprovedAliasCatalog } from "./loadApprovedAliasCatalog";
import { resolveProductIntelligence } from "./resolveProductIntelligence";
import type { ApprovedAliasCatalog, ProductIntelligenceResolution } from "./types";

export interface ProductIntelligenceService {
  /** Cached snapshot from last load (read-only). */
  getCatalog(): ApprovedAliasCatalog | null;
  /** SELECT-only refresh from `product_aliases` + `products`. */
  loadCatalog(): Promise<ApprovedAliasCatalog>;
  /** Resolve free-form customer text against loaded catalogue. */
  resolve(utterance: string): ProductIntelligenceResolution;
}

export function createProductIntelligenceService(
  supabase: SupabaseClient,
): ProductIntelligenceService {
  let catalog: ApprovedAliasCatalog | null = null;

  return {
    getCatalog() {
      return catalog;
    },
    async loadCatalog() {
      catalog = await loadApprovedAliasCatalog(supabase);
      return catalog;
    },
    resolve(utterance: string) {
      if (!catalog) {
        return {
          utterance: utterance.trim(),
          candidate_products: [],
          best_match: null,
          clarification_required: true,
          explanation: "Catalogue not loaded. Run loadCatalog() first (read-only SELECT).",
        };
      }
      return resolveProductIntelligence(catalog, utterance);
    },
  };
}
