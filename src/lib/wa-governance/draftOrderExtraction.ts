import type { ClientResolutionResult } from "./clientResolutionTypes";
import type { ProductResolutionResult } from "./productResolutionTypes";
import type { QuantityResolutionResult } from "./quantityResolutionTypes";
import type { SenderIdentityViewModel } from "./senderIdentityTypes";
import { buildDraftOrderGovernanceRoles } from "./draftOrderGovernance";
import type {
  DraftOrderClientSnapshot,
  DraftOrderLineItem,
  ExtractedDraftOrder,
} from "./draftOrderExtractionTypes";
import { computeDraftOrderReadiness } from "./draftOrderReadinessScoring";

export interface DraftOrderExtractionInput {
  packetId: string;
  extractionRequestKey: string;
  sourceText: string;
  client: ClientResolutionResult | null;
  product: ProductResolutionResult | null;
  quantity: QuantityResolutionResult | null;
  senderIdentity: SenderIdentityViewModel | null;
}

function buildClientSnapshot(client: ClientResolutionResult | null): DraftOrderClientSnapshot {
  const best = client?.bestMatch ?? null;
  return {
    companyId: best?.companyId ?? null,
    companyName: best?.companyName ?? null,
    ownerId: best?.ownerId ?? null,
    ownerName: best?.ownerName ?? null,
    confidence: best?.confidence ?? null,
    band: client?.band ?? null,
    explanation: best?.reasons ?? [],
  };
}

function resolveLineProductName(
  productHint: string | null,
  product: ProductResolutionResult | null,
): { productId: string | null; productName: string; sku: string | null; confidence: number | null } {
  if (productHint && product?.candidateProducts.length) {
    const hintLower = productHint.toLowerCase();
    const hinted = product.candidateProducts.find(
      (candidate) =>
        candidate.productName.toLowerCase().includes(hintLower) ||
        hintLower.includes(candidate.productName.toLowerCase()),
    );
    if (hinted) {
      return {
        productId: hinted.productId,
        productName: hinted.productName,
        sku: hinted.sku,
        confidence: hinted.confidence,
      };
    }
  }
  const best = product?.bestMatch ?? null;
  return {
    productId: best?.productId ?? null,
    productName: best?.productName ?? productHint ?? "Unresolved product",
    sku: best?.sku ?? null,
    confidence: best?.confidence ?? null,
  };
}

function buildLineItems(
  product: ProductResolutionResult | null,
  quantity: QuantityResolutionResult | null,
): DraftOrderLineItem[] {
  const entries = quantity?.quantities ?? [];
  if (entries.length === 0) {
    const best = product?.bestMatch;
    if (!best) return [];
    return [
      {
        lineIndex: 0,
        productId: best.productId,
        productName: best.productName,
        sku: best.sku,
        rawQuantity: 1,
        rawUnit: null,
        normalizedQuantity: null,
        normalizedUnit: null,
        productConfidence: best.confidence,
        quantityConfidence: 0,
        productBand: product?.band ?? null,
        quantityBand: "needs_clarification",
        originalTextSpan: null,
        conversionExplanation: "No explicit quantity in WA-06A — placeholder qty 1 for draft preview only.",
        resolutionReasons: [...best.reasons, "Quantity missing — not persisted."],
      },
    ];
  }

  return entries.map((entry, index) => {
    const resolvedProduct = resolveLineProductName(entry.productHint, product);
    const conversionExplanation =
      entry.conversionStatus === "resolved" && entry.normalizedQuantity != null
        ? `Converted ${entry.rawQuantity} ${entry.rawUnit ?? ""} → ${entry.normalizedQuantity} ${entry.normalizedUnit ?? ""} via ${entry.conversionSource ?? "catalogue"}.`
        : entry.conversionStatus === "unknown"
          ? `Unit ${entry.rawUnit ?? "unknown"} not normalized — review before any write path.`
          : null;

    return {
      lineIndex: index,
      productId: resolvedProduct.productId,
      productName: resolvedProduct.productName,
      sku: resolvedProduct.sku,
      rawQuantity: entry.rawQuantity,
      rawUnit: entry.rawUnit,
      normalizedQuantity: entry.normalizedQuantity ?? null,
      normalizedUnit: entry.normalizedUnit ?? null,
      productConfidence: resolvedProduct.confidence,
      quantityConfidence: entry.confidence,
      productBand: product?.band ?? null,
      quantityBand: entry.band,
      originalTextSpan: entry.productHint,
      conversionExplanation,
      resolutionReasons: [...entry.reasons, ...(product?.bestMatch?.reasons.slice(0, 2) ?? [])],
    };
  });
}

function buildConversionSummary(lineItems: DraftOrderLineItem[]): string[] {
  const summary: string[] = [];
  if (lineItems.length === 0) {
    summary.push("No line items extracted — upstream product/quantity resolution incomplete.");
    return summary;
  }
  summary.push(`Extracted ${lineItems.length} draft line item(s) from WA-05A + WA-06A.`);
  for (const line of lineItems) {
    const qty = line.normalizedQuantity ?? line.rawQuantity;
    const unit = line.normalizedUnit ?? line.rawUnit ?? "unit";
    summary.push(
      `Line ${line.lineIndex + 1}: ${line.productName} × ${qty} ${unit} (product ${line.productConfidence ?? "—"}%, qty ${line.quantityConfidence}%).`,
    );
    if (line.conversionExplanation) summary.push(line.conversionExplanation);
  }
  summary.push("Draft projection only — does not insert into orders or order_items.");
  return summary;
}

export function extractDraftOrderFromResolution(input: DraftOrderExtractionInput): ExtractedDraftOrder {
  const lineItems = buildLineItems(input.product, input.quantity);
  const readiness = computeDraftOrderReadiness({
    client: input.client,
    product: input.product,
    quantity: input.quantity,
    combinedText: input.sourceText,
  });
  const governance = buildDraftOrderGovernanceRoles({
    client: input.client,
    senderIdentity: input.senderIdentity,
  });

  return {
    packetId: input.packetId,
    extractionRequestKey: input.extractionRequestKey,
    status: "ready",
    sourceText: input.sourceText,
    client: buildClientSnapshot(input.client),
    lineItems,
    readiness,
    governance,
    conversionSummary: buildConversionSummary(lineItems),
    upstreamErrorMessage: null,
  };
}

export function buildPendingDraftOrder(args: {
  packetId: string;
  extractionRequestKey: string;
  sourceText: string;
  status: ExtractedDraftOrder["status"];
  upstreamErrorMessage?: string | null;
}): ExtractedDraftOrder {
  return {
    packetId: args.packetId,
    extractionRequestKey: args.extractionRequestKey,
    status: args.status,
    sourceText: args.sourceText,
    client: {
      companyId: null,
      companyName: null,
      ownerId: null,
      ownerName: null,
      confidence: null,
      band: null,
      explanation: [],
    },
    lineItems: [],
    readiness: {
      overallScore: 0,
      dimensions: [],
    },
    governance: buildDraftOrderGovernanceRoles({ client: null, senderIdentity: null }),
    conversionSummary: ["Waiting for WA-04A / WA-05A / WA-06A resolution chain."],
    upstreamErrorMessage: args.upstreamErrorMessage ?? null,
  };
}
