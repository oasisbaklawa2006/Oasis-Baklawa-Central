export type QuantityResolutionConfidenceBand =
  | "auto_highlight"
  | "suggested"
  | "needs_clarification";

export interface QuantityResolutionEntry {
  value: number;
  unit: string | null;
  productHint: string | null;
  confidence: number;
  reasons: string[];
  band: QuantityResolutionConfidenceBand;
  normalizedValue?: number | null;
  normalizedUnit?: string | null;
  normalizationReason?: string | null;
}

export interface QuantityResolutionResult {
  quantities: QuantityResolutionEntry[];
  band: QuantityResolutionConfidenceBand;
}

export interface QuantityResolutionInput {
  messageText: string;
  stitchedPlainText?: string;
  productId?: string | null;
}

export type QuantityMatchKind = "explicit_with_unit" | "explicit_qty_only" | "word_quantity";

export interface RawQuantityMatch {
  value: number;
  unit: string | null;
  productHint: string | null;
  kind: QuantityMatchKind;
  sourceSpan: { start: number; end: number };
  rawText: string;
}

export interface QuantityResolutionTextSignals {
  combinedText: string;
  matches: RawQuantityMatch[];
}
