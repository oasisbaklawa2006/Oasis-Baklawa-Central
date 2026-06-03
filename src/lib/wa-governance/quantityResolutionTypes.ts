export type QuantityResolutionConfidenceBand =
  | "auto_highlight"
  | "suggested"
  | "needs_clarification";

export type QuantityConversionStatus = "resolved" | "unknown";

export interface QuantityResolutionEntry {
  rawQuantity: number;
  rawUnit: string | null;
  normalizedQuantity?: number | null;
  normalizedUnit?: string | null;
  conversionSource?: string | null;
  conversionStatus: QuantityConversionStatus;
  productHint: string | null;
  confidence: number;
  reasons: string[];
  band: QuantityResolutionConfidenceBand;
}

export interface QuantityResolutionResult {
  quantities: QuantityResolutionEntry[];
  band: QuantityResolutionConfidenceBand;
}

export interface QuantityResolutionInput {
  messageText: string;
  stitchedPlainText?: string;
  productId?: string | null;
  productBestMatchName?: string | null;
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
