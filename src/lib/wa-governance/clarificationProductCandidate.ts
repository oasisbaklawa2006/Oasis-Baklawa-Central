import type { ProductResolutionCandidate } from "@/lib/wa-governance/productResolutionTypes";

export function buildProductAliasLearningCapture(input: {
  caseId: string;
  packetId: string;
  candidate: ProductResolutionCandidate;
  observedValue: string;
  idempotencyKey: string;
  sourceMessageId?: string | null;
}) {
  const observed = input.observedValue.trim();
  if (!observed) throw new Error("LEARNING_OBSERVED_VALUE_REQUIRED");
  return {
    caseId: input.caseId,
    sourceMessageId: input.sourceMessageId ?? null,
    candidateType: "PRODUCT_ALIAS",
    observedValue: observed,
    proposedMapping: {
      productId: input.candidate.productId,
      sku: input.candidate.sku,
      productName: input.candidate.productName,
      catalogueConfidence: input.candidate.confidence,
    },
    evidence: {
      packet_id: input.packetId,
      selection: "clarification_product_chip",
      reasons: input.candidate.reasons.slice(0, 6),
    },
    idempotencyKey: input.idempotencyKey,
  };
}

export function clarificationChipCandidates(
  bestMatch: ProductResolutionCandidate | null,
  alternatives: ProductResolutionCandidate[],
): ProductResolutionCandidate[] {
  const merged = [bestMatch, ...alternatives].filter(
    (candidate): candidate is ProductResolutionCandidate => candidate !== null,
  );
  const seen = new Set<string>();
  return merged.filter((candidate) => {
    if (!candidate.productId || seen.has(candidate.productId)) return false;
    seen.add(candidate.productId);
    return true;
  }).slice(0, 4);
}

export function observedProductPhrase(input: {
  stitchedText?: string;
  orderLineProductName?: string | null;
  fallback?: string | null;
}): string {
  const fromLine = input.orderLineProductName?.trim();
  if (fromLine) return fromLine.slice(0, 500);
  const stitched = input.stitchedText?.trim();
  if (stitched) return stitched.slice(0, 500);
  const fallback = input.fallback?.trim();
  if (fallback) return fallback.slice(0, 500);
  return "";
}
