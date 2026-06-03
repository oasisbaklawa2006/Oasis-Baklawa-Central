import { describe, expect, it } from "vitest";
import {
  confidenceBandFromPercent,
  PRODUCT_RESOLUTION_SIGNAL_WEIGHTS,
  scoreProductResolutionCandidates,
} from "@/lib/wa-governance/productResolutionScoring";
import type {
  ProductResolutionRow,
  ProductResolutionTextSignals,
} from "@/lib/wa-governance/productResolutionTypes";

const baseSignals = (
  overrides: Partial<ProductResolutionTextSignals> = {},
): ProductResolutionTextSignals => ({
  combinedText: "",
  productNameCandidates: [],
  aliasCandidates: [],
  weightTokens: [],
  weightGrams: [],
  pieceCountTokens: [],
  pieceCounts: [],
  packFormatTokens: [],
  catalogKeywords: [],
  quantityReferences: [],
  ...overrides,
});

const product = (
  partial: Partial<ProductResolutionRow> & Pick<ProductResolutionRow, "id" | "name" | "sku">,
): ProductResolutionRow => ({
  aliases: null,
  pack_size: null,
  net_weight_grams: null,
  avg_weight_per_pack: null,
  primary_pack_weight_kg: null,
  uom: "Pc",
  category: null,
  sub_category: null,
  ...partial,
});

describe("productResolutionScoring", () => {
  it("scores exact product name match at suggested band", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({ productNameCandidates: ["Assorted Baklawa 400gm Tin"] }),
      products: [
        product({
          id: "p-1",
          name: "Assorted Baklawa 400gm Tin",
          sku: "BK-400-TIN",
        }),
      ],
    });

    expect(result.bestMatch?.productName).toBe("Assorted Baklawa 400gm Tin");
    expect(result.bestMatch?.confidence).toBe(80);
    expect(result.band).toBe("suggested");
  });

  it("combines signals for auto-highlight band", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({
        productNameCandidates: ["Assorted Baklawa 400gm Tin"],
        weightGrams: [400],
        packFormatTokens: ["tin"],
      }),
      products: [
        product({
          id: "p-1",
          name: "Assorted Baklawa 400gm Tin",
          sku: "BK-400-TIN",
          net_weight_grams: 400,
          pack_size: "400gm tin",
        }),
      ],
    });

    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(95);
    expect(result.band).toBe("auto_highlight");
  });

  it("scores alias match", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({ aliasCandidates: ["Baklawa"] }),
      products: [
        product({
          id: "p-alias",
          name: "Mixed Baklawa Gift Box",
          sku: "BK-GIFT",
          aliases: ["Baklawa", "Baklava"],
        }),
      ],
      aliasHits: new Map([["p-alias", ["Baklawa"]]]),
    });

    expect(result.bestMatch?.reasons.some((reason) => reason.includes("alias"))).toBe(true);
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(45);
  });

  it("scores weight match", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({ weightGrams: [400], weightTokens: ["400gm"] }),
      products: [
        product({
          id: "p-weight",
          name: "Assorted Baklawa Tin",
          sku: "BK-400",
          net_weight_grams: 400,
          pack_size: "400gm tin",
        }),
      ],
    });

    expect(result.bestMatch?.reasons.some((reason) => reason.toLowerCase().includes("weight"))).toBe(
      true,
    );
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(35);
  });

  it("scores piece-count match", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({ pieceCounts: [24], pieceCountTokens: ["24pc"] }),
      products: [
        product({
          id: "p-pc",
          name: "Acrylic Gift Box 24pc",
          sku: "AC-24",
          pack_size: "24 pc acrylic box",
        }),
      ],
    });

    expect(result.bestMatch?.reasons.some((reason) => reason.includes("24"))).toBe(true);
  });

  it("returns multiple candidates when message is ambiguous", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({
        productNameCandidates: ["Baklawa", "Chocolate"],
        catalogKeywords: ["Baklawa", "Chocolate"],
      }),
      products: [
        product({ id: "p-a", name: "Mixed Baklawa Tin", sku: "A", category: "Baklawa" }),
        product({ id: "p-b", name: "Chocolate Dragees Box", sku: "B", category: "Chocolate" }),
      ],
    });

    expect(result.candidateProducts.length).toBeGreaterThanOrEqual(2);
    expect(result.bestMatch?.confidence).toBeLessThan(95);
  });

  it("returns no match when nothing scores", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({ productNameCandidates: ["Unknown SKU XYZ"] }),
      products: [
        product({ id: "p-none", name: "Unrelated Product", sku: "ZZ-1" }),
      ],
    });

    expect(result.bestMatch).toBeNull();
    expect(result.band).toBe("needs_clarification");
  });

  it("does not duplicate the same signal weight for one product", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({
        productNameCandidates: ["Assorted Baklawa 400gm Tin", "Assorted Baklawa 400gm Tin"],
      }),
      products: [
        product({
          id: "p-dedupe",
          name: "Assorted Baklawa 400gm Tin",
          sku: "BK-400-TIN",
        }),
      ],
    });

    const exactReasons = result.bestMatch?.reasons.filter((reason) =>
      reason.includes("Exact product name"),
    );
    expect(exactReasons?.length).toBe(1);
    expect(result.bestMatch?.confidence).toBe(
      Math.round(PRODUCT_RESOLUTION_SIGNAL_WEIGHTS.exactProductName * 100),
    );
  });

  it("maps confidence bands at 95 and 70 thresholds", () => {
    expect(confidenceBandFromPercent(96)).toBe("auto_highlight");
    expect(confidenceBandFromPercent(80)).toBe("suggested");
    expect(confidenceBandFromPercent(40)).toBe("needs_clarification");
  });
});
