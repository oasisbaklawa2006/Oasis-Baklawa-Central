export type GoldenUtteranceCategory =
  | "batch001_specific"
  | "batch001_quantity"
  | "ambiguous_family"
  | "generic_only"
  | "multilingual"
  | "typo_tolerance"
  | "search_fallback"
  | "negative";

export type GoldenExpectedOutcome = "resolve" | "clarify" | "no_match";

export interface GoldenUtteranceCase {
  id: string;
  utterance: string;
  category: GoldenUtteranceCategory;
  expected: GoldenExpectedOutcome;
  /** Authoritative SKU when expected = resolve */
  expectedSku?: string;
  /** Competing SKUs when expected = clarify */
  clarifySkus?: string[];
  notes?: string;
}
