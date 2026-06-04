import type { ClientResolutionResult } from "./clientResolutionTypes";
import type { ProductResolutionResult } from "./productResolutionTypes";
import type { QuantityResolutionResult } from "./quantityResolutionTypes";
import {
  extractAddressPaymentTextSignals,
  type AddressPaymentTextSignals,
} from "./draftOrderTextSignals";
import type {
  DraftOrderReadinessDimension,
  DraftOrderReadinessSnapshot,
} from "./draftOrderExtractionTypes";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bandToBaseScore(band: string | null | undefined): number {
  switch (band) {
    case "auto_highlight":
      return 92;
    case "suggested":
      return 72;
    case "needs_clarification":
      return 42;
    default:
      return 0;
  }
}

function dimensionStatus(score: number): DraftOrderReadinessDimension["status"] {
  if (score >= 75) return "ready";
  if (score >= 40) return "partial";
  return "missing";
}

export function scoreClientReadiness(client: ClientResolutionResult | null): DraftOrderReadinessDimension {
  if (!client?.bestMatch) {
    return {
      dimension: "client",
      score: 0,
      status: "missing",
      explanation: "No client match from WA-04A — clarify company before draft promotion.",
    };
  }
  const score = clampScore(client.bestMatch.confidence);
  return {
    dimension: "client",
    score,
    status: dimensionStatus(score),
    explanation: `WA-04A best match ${client.bestMatch.companyName} at ${client.bestMatch.confidence}% (${client.band}).`,
  };
}

export function scoreProductReadiness(product: ProductResolutionResult | null): DraftOrderReadinessDimension {
  if (!product?.bestMatch) {
    return {
      dimension: "product",
      score: 0,
      status: "missing",
      explanation: "No product match from WA-05A — SKU/name clarification required.",
    };
  }
  const score = clampScore(product.bestMatch.confidence);
  return {
    dimension: "product",
    score,
    status: dimensionStatus(score),
    explanation: `WA-05A best match ${product.bestMatch.productName} at ${product.bestMatch.confidence}% (${product.band}).`,
  };
}

export function scoreQuantityReadiness(
  quantity: QuantityResolutionResult | null,
): DraftOrderReadinessDimension {
  if (!quantity?.quantities.length) {
    return {
      dimension: "quantity",
      score: 0,
      status: "missing",
      explanation: "WA-06A found no explicit quantity — defaulting to clarification.",
    };
  }
  const best = quantity.quantities.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  const score = clampScore(Math.max(bandToBaseScore(quantity.band), best.confidence));
  const unitLabel = best.normalizedUnit ?? best.rawUnit ?? "unit";
  const qtyLabel = best.normalizedQuantity ?? best.rawQuantity;
  return {
    dimension: "quantity",
    score,
    status: dimensionStatus(score),
    explanation: `WA-06A primary quantity ${qtyLabel} ${unitLabel} at ${best.confidence}% (${quantity.band}).`,
  };
}

export function scoreAddressReadiness(signals: AddressPaymentTextSignals): DraftOrderReadinessDimension {
  let score = 0;
  const parts: string[] = [];
  if (signals.hasPincode) {
    score += 45;
    parts.push("pincode detected");
  }
  if (signals.hasAddressKeyword) {
    score += 30;
    parts.push("address keyword");
  }
  if (signals.hasCityToken) {
    score += 25;
    parts.push("city token");
  }
  score = clampScore(score);
  return {
    dimension: "address",
    score,
    status: dimensionStatus(score),
    explanation:
      score > 0
        ? `Message text signals: ${parts.join(", ")}.${signals.addressSnippet ? ` Snippet: "${signals.addressSnippet.slice(0, 80)}…"` : ""}`
        : "No delivery address or pincode detected in message text.",
  };
}

export function scorePaymentTermsReadiness(signals: AddressPaymentTextSignals): DraftOrderReadinessDimension {
  let score = 0;
  const parts: string[] = [];
  if (signals.hasPaymentTermsKeyword) {
    score += 50;
    parts.push("payment terms keyword");
  }
  if (signals.hasAdvanceKeyword) {
    score += 30;
    parts.push("advance terms");
  }
  if (signals.hasCreditKeyword) {
    score += 25;
    parts.push("credit terms");
  }
  score = clampScore(score);
  return {
    dimension: "payment_terms",
    score,
    status: dimensionStatus(score),
    explanation:
      score > 0
        ? `Message text signals: ${parts.join(", ")}.${signals.paymentTermsSnippet ? ` Detected: "${signals.paymentTermsSnippet}"` : ""}`
        : "No explicit payment terms in message — defaults to standard advance pending.",
  };
}

export function computeDraftOrderReadiness(args: {
  client: ClientResolutionResult | null;
  product: ProductResolutionResult | null;
  quantity: QuantityResolutionResult | null;
  combinedText: string;
}): DraftOrderReadinessSnapshot {
  const signals = extractAddressPaymentTextSignals(args.combinedText);
  const dimensions: DraftOrderReadinessDimension[] = [
    scoreClientReadiness(args.client),
    scoreProductReadiness(args.product),
    scoreQuantityReadiness(args.quantity),
    scoreAddressReadiness(signals),
    scorePaymentTermsReadiness(signals),
  ];
  const overallScore = clampScore(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length,
  );
  return { overallScore, dimensions };
}
