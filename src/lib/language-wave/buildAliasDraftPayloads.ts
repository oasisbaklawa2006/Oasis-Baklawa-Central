import type { CatalogueAliasDraftPayload, ClassifiedLanguageTerm } from "./types";

/** Build governed `catalogue_alias_drafts` payloads — file-only; no DB writes. */
export function buildAliasDraftPayloads(
  safeTerms: ClassifiedLanguageTerm[],
): CatalogueAliasDraftPayload[] {
  return safeTerms.map((term) => ({
    operation: "insert" as const,
    alias_text: term.term,
    canonical_name: term.canonicalName,
    product_id: term.productId,
    metadata: {
      wave: term.wave,
      term_kind: term.kind,
      sku: term.sku,
      classification: "SAFE_TO_APPROVE" as const,
    },
  }));
}
