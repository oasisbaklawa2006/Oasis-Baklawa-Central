import type {
  ProductResolutionConfidenceBand,
  ProductResolutionResult,
  ProductResolutionRow,
  ProductResolutionScoreReason,
  ProductResolutionTextSignals,
} from "./productResolutionTypes";
import { productNameMatchesTerm } from "./productResolutionSignals";

export const PRODUCT_RESOLUTION_SIGNAL_WEIGHTS = {
  exactProductName: 0.8,
  productAlias: 0.45,
  weightMatch: 0.35,
  pieceCountMatch: 0.3,
  packFormatMatch: 0.25,
  catalogKeywordMatch: 0.18,
} as const;

const MAX_SCORE = 0.98;

function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(0, score));
}

function addReason(
  bucket: Map<string, ProductResolutionScoreReason[]>,
  productId: string,
  weight: number,
  reason: string,
  scoredSignals: Map<string, Set<string>>,
  signalKey: string,
): void {
  const scored = scoredSignals.get(productId) ?? new Set<string>();
  if (scored.has(signalKey)) return;
  scored.add(signalKey);
  scoredSignals.set(productId, scored);

  const list = bucket.get(productId) ?? [];
  list.push({ productId, weight, reason });
  bucket.set(productId, list);
}

function productSearchText(product: ProductResolutionRow): string {
  return [
    product.name,
    product.sku,
    product.pack_size ?? "",
    product.category ?? "",
    product.sub_category ?? "",
    ...(product.aliases ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function productWeightGrams(product: ProductResolutionRow): number[] {
  const grams: number[] = [];
  if (product.net_weight_grams != null) grams.push(Math.round(product.net_weight_grams));
  if (product.avg_weight_per_pack != null) grams.push(Math.round(product.avg_weight_per_pack * 1000));
  if (product.primary_pack_weight_kg != null) {
    grams.push(Math.round(product.primary_pack_weight_kg * 1000));
  }
  return [...new Set(grams.filter((value) => value > 0))];
}

function weightMatchesProduct(product: ProductResolutionRow, targetGrams: number): boolean {
  const tolerance = Math.max(15, Math.round(targetGrams * 0.08));
  return productWeightGrams(product).some((grams) => Math.abs(grams - targetGrams) <= tolerance);
}

function pieceCountMatchesProduct(product: ProductResolutionRow, count: number): boolean {
  const haystack = productSearchText(product);
  return (
    haystack.includes(`${count}pc`) ||
    haystack.includes(`${count} pc`) ||
    haystack.includes(`${count} piece`) ||
    haystack.includes(`${count}-pc`)
  );
}

function packFormatMatchesProduct(product: ProductResolutionRow, token: string): boolean {
  return productSearchText(product).includes(token.toLowerCase());
}

export function confidenceBandFromPercent(confidence: number): ProductResolutionConfidenceBand {
  if (confidence >= 95) return "auto_highlight";
  if (confidence >= 70) return "suggested";
  return "needs_clarification";
}

export function formatProductConfidencePercent(score: number): number {
  return Math.round(clampScore(score) * 100);
}

export interface ScoreProductResolutionInput {
  signals: ProductResolutionTextSignals;
  products: ProductResolutionRow[];
  aliasHits?: Map<string, string[]>;
  additionalReasons?: Map<string, ProductResolutionScoreReason[]>;
}

export function scoreProductResolutionCandidates(
  input: ScoreProductResolutionInput,
): ProductResolutionResult {
  const reasonsByProduct = new Map<string, ProductResolutionScoreReason[]>();
  const scoredSignals = new Map<string, Set<string>>();

  for (const [productId, reasons] of input.additionalReasons ?? []) {
    reasonsByProduct.set(productId, [...reasons]);
    const scored = scoredSignals.get(productId) ?? new Set<string>();
    for (const reason of reasons) {
      scored.add(`additional:${reason.reason}`);
    }
    scoredSignals.set(productId, scored);
  }

  for (const product of input.products) {
    for (const term of input.signals.productNameCandidates) {
      if (product.name.toLowerCase() === term.toLowerCase()) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.exactProductName,
          `Exact product name "${term}" matches catalog`,
          scoredSignals,
          `exact:${term.toLowerCase()}`,
        );
      } else if (productNameMatchesTerm(product.name, term)) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.exactProductName * 0.75,
          `Product name contains "${term}"`,
          scoredSignals,
          `partial-name:${term.toLowerCase()}`,
        );
      }
    }

    for (const alias of input.aliasHits?.get(product.id) ?? []) {
      addReason(
        reasonsByProduct,
        product.id,
        PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.productAlias,
        `Product alias "${alias}" matches message`,
        scoredSignals,
        `alias:${alias.toLowerCase()}`,
      );
    }

    for (const alias of product.aliases ?? []) {
      if (
        input.signals.aliasCandidates.some(
          (candidate) =>
            candidate.toLowerCase().includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(candidate.toLowerCase()),
        )
      ) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.productAlias,
          `Catalog alias "${alias}" appears in message`,
          scoredSignals,
          `catalog-alias:${alias.toLowerCase()}`,
        );
      }
    }

    for (const grams of input.signals.weightGrams) {
      if (weightMatchesProduct(product, grams)) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.weightMatch,
          `Pack weight ~${grams}g matches message weight reference`,
          scoredSignals,
          `weight:${grams}`,
        );
      }
    }

    for (const token of input.signals.weightTokens) {
      if (productSearchText(product).includes(token.replace(/\s+/g, ""))) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.weightMatch,
          `Weight token "${token}" matches product pack label`,
          scoredSignals,
          `weight-token:${token}`,
        );
      }
    }

    for (const count of input.signals.pieceCounts) {
      if (pieceCountMatchesProduct(product, count)) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.pieceCountMatch,
          `Piece count ${count} matches product pack label`,
          scoredSignals,
          `piece:${count}`,
        );
      }
    }

    for (const token of input.signals.packFormatTokens) {
      if (packFormatMatchesProduct(product, token)) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.packFormatMatch,
          `Pack format "${token}" matches product description`,
          scoredSignals,
          `pack:${token.toLowerCase()}`,
        );
      }
    }

    for (const keyword of input.signals.catalogKeywords) {
      const haystack = productSearchText(product);
      if (haystack.includes(keyword.toLowerCase())) {
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.catalogKeywordMatch,
          `Catalog keyword "${keyword}" matches product metadata`,
          scoredSignals,
          `keyword:${keyword.toLowerCase()}`,
        );
      }
    }
  }

  const candidateProducts = input.products
    .map((product) => {
      const reasons = reasonsByProduct.get(product.id) ?? [];
      const score = clampScore(reasons.reduce((sum, reason) => sum + reason.weight, 0));
      if (score <= 0) return null;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        confidence: formatProductConfidencePercent(score),
        reasons: reasons.map((reason) => reason.reason),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
    .sort((a, b) => b.confidence - a.confidence || a.productName.localeCompare(b.productName));

  const bestMatch = candidateProducts[0] ?? null;
  const band = bestMatch
    ? confidenceBandFromPercent(bestMatch.confidence)
    : "needs_clarification";

  return {
    candidateProducts,
    bestMatch,
    band,
  };
}
