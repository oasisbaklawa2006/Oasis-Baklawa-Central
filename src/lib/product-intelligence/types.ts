/** Read-only product row used by the intelligence resolver (from `products` SELECT). */
export interface IntelligenceProductRow {
  id: string;
  name: string;
  sku: string;
  pack_size: string | null;
  net_weight_grams: number | null;
  uom: string | null;
  category: string | null;
  sub_category: string | null;
  /** Merged from `products.aliases[]` plus approved `product_aliases` rows. */
  approved_aliases: string[];
}

/** Approved language row from `product_aliases` (AI Studio / admin promoted). */
export interface IntelligenceAliasRow {
  alias_text: string;
  canonical_name: string;
  product_id: string | null;
}

/** In-memory catalogue snapshot — no writes. */
export interface ApprovedAliasCatalog {
  products: IntelligenceProductRow[];
  aliases: IntelligenceAliasRow[];
  loaded_at: string;
  product_count: number;
  /** `product_aliases` row count plus `products.aliases[]` entries loaded (pre-merge). */
  alias_count: number;
}

export interface IntelligenceCandidate {
  productId: string;
  productName: string;
  sku: string | null;
  confidence: number;
  matched_aliases: string[];
  reasons: string[];
}

export interface ProductIntelligenceResolution {
  utterance: string;
  candidate_products: IntelligenceCandidate[];
  best_match: IntelligenceCandidate | null;
  clarification_required: boolean;
  explanation: string;
}
