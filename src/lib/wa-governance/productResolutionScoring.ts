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

export const METADATA_ONLY_CONFIDENCE_CEILING = 0.69;
export const WEAK_IDENTITY_CONFIDENCE_CEILING = 0.94;
export const AUTO_HIGHLIGHT_CONFIDENCE_THRESHOLD = 0.95;

const MAX_SCORE = 0.98;

const PACKAGING_KEYWORDS = new Set([
  "tin",
  "tins",
  "tray",
  "trays",
  "carton",
  "cartons",
  "box",
  "boxes",
  "acrylic",
  "case",
  "cases",
  "pack",
  "packs",
  "tin pack",
  "assorted",
  "mixed",
]);

export const STRONG_PRODUCT_FAMILY_KEYWORDS = [
  "baklava",
  "baklawa",
  "mamoul",
  "maamoul",
  "turkish delight",
  "lokum",
  "dates",
  "kunefe",
  "kunafa",
  "dragees",
  "chocolate tray",
  "chocolate box",
  "chocolate",
  "gift box",
  "hamper",
  "basbousa",
  "namoura",
  "barfi",
  "peda",
  "halwa",
  "rasgulla",
  "gulab jamun",
  "sandesh",
  "motichoor",
  "laddu",
  "pistachio",
  "kaju",
] as const;

export type ProductIdentityEvidenceStrength = "none" | "weak" | "strong";

type ProductEvidenceFlags = {
  exactProductName: boolean;
  productAlias: boolean;
  strongProductFamily: boolean;
  partialProductName: boolean;
};

function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(0, score));
}

export function isStrongProductFamilyKeyword(keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized || PACKAGING_KEYWORDS.has(normalized)) return false;
  return STRONG_PRODUCT_FAMILY_KEYWORDS.some(
    (familyKeyword) =>
      normalized === familyKeyword ||
      normalized.includes(familyKeyword) ||
      familyKeyword.includes(normalized),
  );
}

export function classifyProductIdentityStrength(
  flags: ProductEvidenceFlags,
): ProductIdentityEvidenceStrength {
  if (flags.exactProductName || flags.productAlias || flags.strongProductFamily) {
    return "strong";
  }
  if (flags.partialProductName) return "weak";
  return "none";
}

export function applyProductConfidenceCeiling(
  rawScore: number,
  identityStrength: ProductIdentityEvidenceStrength,
): number {
  if (identityStrength === "none") {
    return Math.min(rawScore, METADATA_ONLY_CONFIDENCE_CEILING);
  }
  if (identityStrength === "weak") {
    return Math.min(rawScore, WEAK_IDENTITY_CONFIDENCE_CEILING);
  }
  return clampScore(rawScore);
}

export function confidenceBandFromPercent(confidence: number): ProductResolutionConfidenceBand {
  if (confidence >= 95) return "auto_highlight";
  if (confidence >= 70) return "suggested";
  return "needs_clarification";
}

export function confidenceBandFromScoreAndIdentity(
  score: number,
  identityStrength: ProductIdentityEvidenceStrength,
): ProductResolutionConfidenceBand {
  const confidence = formatProductConfidencePercent(score);
  if (identityStrength === "none") return "needs_clarification";
  if (identityStrength === "weak") {
    return confidence >= 70 ? "suggested" : "needs_clarification";
  }
  if (confidence >= 95) return "auto_highlight";
  if (confidence >= 70) return "suggested";
  return "needs_clarification";
}

export function formatProductConfidencePercent(score: number): number {
  return Math.round(clampScore(score) * 100);
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

function isPackagingOnlyTerm(term: string): boolean {
  const normalized = term.trim().toLowerCase();
  return PACKAGING_KEYWORDS.has(normalized) && !isStrongProductFamilyKeyword(term);
}

function productNameTermEligibleForIdentity(term: string): boolean {
  return !isPackagingOnlyTerm(term);
}

function emptyEvidenceFlags(): ProductEvidenceFlags {
  return {
    exactProductName: false,
    productAlias: false,
    strongProductFamily: false,
    partialProductName: false,
  };
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
  const evidenceByProduct = new Map<string, ProductEvidenceFlags>();
  const scoredSignals = new Map<string, Set<string>>();

  function evidenceFor(productId: string): ProductEvidenceFlags {
    const existing = evidenceByProduct.get(productId);
    if (existing) return existing;
    const created = emptyEvidenceFlags();
    evidenceByProduct.set(productId, created);
    return created;
  }

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
      if (!productNameTermEligibleForIdentity(term)) continue;

      if (product.name.toLowerCase() === term.toLowerCase()) {
        evidenceFor(product.id).exactProductName = true;
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.exactProductName,
          `Exact product name "${term}" matches catalog`,
          scoredSignals,
          `exact:${term.toLowerCase()}`,
        );
      } else if (productNameMatchesTerm(product.name, term)) {
        evidenceFor(product.id).partialProductName = true;
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
      evidenceFor(product.id).productAlias = true;
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
        evidenceFor(product.id).productAlias = true;
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
      if (!haystack.includes(keyword.toLowerCase())) continue;

      if (isStrongProductFamilyKeyword(keyword)) {
        evidenceFor(product.id).strongProductFamily = true;
        addReason(
          reasonsByProduct,
          product.id,
          PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.catalogKeywordMatch,
          `Product family keyword "${keyword}" matches catalog metadata`,
          scoredSignals,
          `family-keyword:${keyword.toLowerCase()}`,
        );
        continue;
      }

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

  const scoredCandidates = input.products
    .map((product) => {
      const reasons = reasonsByProduct.get(product.id) ?? [];
      const rawScore = clampScore(reasons.reduce((sum, reason) => sum + reason.weight, 0));
      if (rawScore <= 0) return null;

      const identityStrength = classifyProductIdentityStrength(
        evidenceByProduct.get(product.id) ?? emptyEvidenceFlags(),
      );
      const cappedScore = applyProductConfidenceCeiling(rawScore, identityStrength);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        confidence: formatProductConfidencePercent(cappedScore),
        reasons: reasons.map((reason) => reason.reason),
        identityStrength,
        cappedScore,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.cappedScore - a.cappedScore ||
        a.productName.localeCompare(b.productName),
    );

  const bestScored = scoredCandidates[0] ?? null;
  const candidateProducts = scoredCandidates.map(
    ({ identityStrength: _identityStrength, cappedScore: _cappedScore, ...candidate }) => candidate,
  );
  const bestMatch = candidateProducts[0] ?? null;
  const band = bestScored
    ? confidenceBandFromScoreAndIdentity(bestScored.cappedScore, bestScored.identityStrength)
    : "needs_clarification";

  return {
    candidateProducts,
    bestMatch,
    band,
  };
}
