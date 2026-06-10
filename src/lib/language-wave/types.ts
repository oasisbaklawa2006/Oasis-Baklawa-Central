export type LanguageTermKind =
  | "official_alias"
  | "whatsapp_keyword"
  | "customer_term"
  | "search_keyword";

export type SafeToApproveClassification =
  | "SAFE_TO_APPROVE"
  | "BLOCKED_GENERIC"
  | "BLOCKED_CROSS_SKU_COLLISION"
  | "BLOCKED_DUPLICATE_IN_PACK"
  | "BLOCKED_AMBIGUOUS_TOKEN"
  | "BLOCKED_MISSING_PRODUCT";

export interface Batch001Product {
  sku: string;
  productId: string;
  name: string;
  category: string;
  packSize: string;
}

export interface LanguageTermProposal {
  sku: string;
  productId: string;
  canonicalName: string;
  kind: LanguageTermKind;
  term: string;
  wave: string;
}

export interface ClassifiedLanguageTerm extends LanguageTermProposal {
  classification: SafeToApproveClassification;
  reasons: string[];
}

export interface CatalogueAliasDraftPayload {
  operation: "insert";
  alias_text: string;
  canonical_name: string;
  product_id: string;
  metadata: {
    wave: string;
    term_kind: LanguageTermKind;
    sku: string;
    classification: "SAFE_TO_APPROVE";
  };
}

export interface LanguageScanIssue {
  code: "duplicate_in_pack" | "cross_sku_collision" | "ambiguous_token" | "unsafe_generic";
  severity: "error" | "warning";
  term: string;
  skus: string[];
  message: string;
}

export interface LanguageScanResult {
  wave: string;
  term_count: number;
  safe_count: number;
  blocked_count: number;
  issues: LanguageScanIssue[];
  safe_terms: ClassifiedLanguageTerm[];
}

export interface ResolverCoverageRow {
  sku: string;
  utterance: string;
  resolved: boolean;
  clarification_required: boolean;
  productId: string | null;
  confidence: number | null;
}

export interface CatalogueHealthRow {
  sku: string;
  name: string;
  score: number;
  missing: string[];
}
