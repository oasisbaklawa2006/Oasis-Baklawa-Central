import type { PacketAiConclusion } from "./packetContentInterpretation";

export type ProductResolutionConfidenceBand =
  | "auto_highlight"
  | "suggested"
  | "needs_clarification";

export interface ProductResolutionCandidate {
  productId: string;
  productName: string;
  sku: string | null;
  confidence: number;
  reasons: string[];
}

export interface ProductResolutionAiInterpretation {
  conclusion: PacketAiConclusion | null;
  confidence: number;
  language: string;
  warnings: string[];
  usedAi: boolean;
  error?: string;
}

export interface ProductResolutionResult {
  candidateProducts: ProductResolutionCandidate[];
  bestMatch: ProductResolutionCandidate | null;
  band: ProductResolutionConfidenceBand;
  aiInterpretation?: ProductResolutionAiInterpretation;
}

export interface ProductResolutionInput {
  messageText: string;
  stitchedPlainText?: string;
  clientCompanyId?: string | null;
  clientCompanyName?: string | null;
}

export interface ProductResolutionTextSignals {
  combinedText: string;
  productNameCandidates: string[];
  aliasCandidates: string[];
  weightTokens: string[];
  weightGrams: number[];
  pieceCountTokens: string[];
  pieceCounts: number[];
  packFormatTokens: string[];
  catalogKeywords: string[];
  quantityReferences: Array<{ quantity: number; unit: string }>;
}

export interface ProductResolutionRow {
  id: string;
  name: string;
  sku: string;
  aliases: string[] | null;
  pack_size: string | null;
  net_weight_grams: number | null;
  avg_weight_per_pack: number | null;
  primary_pack_weight_kg: number | null;
  uom: string | null;
  category: string | null;
  sub_category: string | null;
}

export interface ProductAliasRow {
  alias_text: string;
  canonical_name: string;
  product_id: string | null;
}

export type ProductResolutionScoreReason = {
  productId: string;
  weight: number;
  reason: string;
};
