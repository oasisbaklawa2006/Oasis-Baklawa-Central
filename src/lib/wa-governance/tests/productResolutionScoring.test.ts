import { describe, expect, it } from "vitest";
import { extractProductResolutionTextSignals } from "@/lib/wa-governance/productResolutionSignals";
import {
  isIdentityAlias,
  isPackagingAlias,
} from "@/lib/wa-governance/productResolutionAliasPolicy";
import {
  applyProductConfidenceCeiling,
  classifyProductIdentityStrength,
  confidenceBandFromPercent,
  confidenceBandFromScoreAndIdentity,
  isStrongProductFamilyKeyword,
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

  it("scores weight match but caps metadata-only candidates at 69%", () => {
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
    expect(result.bestMatch?.confidence).toBeLessThanOrEqual(69);
    expect(result.band).toBe("needs_clarification");
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

  it("Case A: metadata-only 400gm tin 24 pc stays at or below 69% needs clarification", () => {
    const signals = extractProductResolutionTextSignals("400gm tin 24 pc", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-generic",
          name: "Generic Assorted Tin",
          sku: "GEN-1",
          pack_size: "400gm tin 24 pc",
          net_weight_grams: 400,
        }),
      ],
    });

    expect(result.bestMatch?.confidence).toBeLessThanOrEqual(69);
    expect(result.band).toBe("needs_clarification");
    expect(result.bestMatch?.reasons.some((reason) => reason.includes("Exact product name"))).toBe(
      false,
    );
    expect(result.bestMatch?.reasons.some((reason) => reason.includes("alias"))).toBe(false);
    expect(
      result.bestMatch?.reasons.some((reason) => reason.includes("Product family keyword")),
    ).toBe(false);
  });

  it("Case B: Baklava 400gm tin with identity and metadata can reach suggested or auto-highlight", () => {
    const signals = extractProductResolutionTextSignals("Baklava 400gm tin", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-baklava",
          name: "Assorted Baklava 400gm Tin",
          sku: "BK-400",
          net_weight_grams: 400,
          pack_size: "400gm tin",
          category: "Baklava",
        }),
      ],
    });

    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
    expect(["suggested", "auto_highlight"]).toContain(result.band);
    expect(
      result.bestMatch?.reasons.some(
        (reason) =>
          reason.includes("Product family keyword") ||
          reason.includes("Exact product name") ||
          reason.includes("Product name contains"),
      ),
    ).toBe(true);
  });

  it("Case C: Mamoul 24 pc with identity is eligible for suggested band or higher", () => {
    const signals = extractProductResolutionTextSignals("Mamoul 24 pc", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-mamoul",
          name: "Maamoul Dates Box 24pc",
          sku: "MM-24",
          pack_size: "24 pc box",
          category: "Maamoul",
        }),
      ],
    });

    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
    expect(result.band).not.toBe("needs_clarification");
    expect(
      result.bestMatch?.reasons.some((reason) => reason.includes("Product family keyword")),
    ).toBe(true);
  });

  it("Case D: metadata-only ambiguity never auto-highlights", () => {
    const signals = extractProductResolutionTextSignals("400gm tin 24 pc", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-a",
          name: "Generic Tin A",
          sku: "A",
          pack_size: "400gm tin 24 pc",
          net_weight_grams: 400,
        }),
        product({
          id: "p-b",
          name: "Generic Tin B",
          sku: "B",
          pack_size: "400gm tin 24 pc",
          net_weight_grams: 400,
        }),
      ],
    });

    expect(result.candidateProducts.length).toBeGreaterThanOrEqual(2);
    expect(result.band).toBe("needs_clarification");
    expect(result.candidateProducts.every((candidate) => candidate.confidence <= 69)).toBe(true);
    expect(result.candidateProducts.every((candidate) => candidate.confidence < 95)).toBe(true);
  });

  it("classifies strong product-family keywords and applies identity ceilings", () => {
    expect(isStrongProductFamilyKeyword("Baklawa")).toBe(true);
    expect(isStrongProductFamilyKeyword("tin")).toBe(false);
    expect(isPackagingAlias("tin")).toBe(true);
    expect(isPackagingAlias("hamper")).toBe(true);
    expect(isIdentityAlias("gift box")).toBe(false);
    expect(isIdentityAlias("Mamoul")).toBe(true);

    expect(classifyProductIdentityStrength({
      exactProductName: false,
      productAlias: false,
      strongProductFamily: false,
      partialProductName: false,
    })).toBe("none");

    expect(applyProductConfidenceCeiling(0.98, "none")).toBe(0.69);
    expect(applyProductConfidenceCeiling(0.98, "weak")).toBe(0.94);
    expect(confidenceBandFromScoreAndIdentity(0.98, "none")).toBe("needs_clarification");
    expect(confidenceBandFromScoreAndIdentity(0.98, "weak")).toBe("suggested");
    expect(confidenceBandFromScoreAndIdentity(0.96, "strong")).toBe("auto_highlight");
  });

  it("does not treat packaging alias hits as product identity evidence", () => {
    const result = scoreProductResolutionCandidates({
      signals: baseSignals({
        aliasCandidates: ["tin"],
        packFormatTokens: ["tin"],
      }),
      products: [
        product({
          id: "p-pack",
          name: "Generic Assorted Tin",
          sku: "GEN-TIN",
          pack_size: "400gm tin",
          aliases: ["tin"],
        }),
      ],
      aliasHits: new Map([["p-pack", ["tin"]]]),
    });

    expect(result.bestMatch?.reasons.some((reason) => reason.includes("alias"))).toBe(false);
    expect(result.bestMatch?.reasons.some((reason) => reason.includes("Pack format"))).toBe(true);
    expect(result.bestMatch?.confidence).toBeLessThanOrEqual(69);
    expect(result.band).toBe("needs_clarification");
  });

  it("metadata-only 400gm hamper stays at or below 69% needs clarification", () => {
    const signals = extractProductResolutionTextSignals("400gm hamper", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-hamper",
          name: "Festive Gift Hamper",
          sku: "HAMP-1",
          pack_size: "400gm hamper",
          net_weight_grams: 400,
        }),
      ],
    });

    expect(signals.aliasCandidates).toEqual([]);
    expect(result.bestMatch?.confidence).toBeLessThanOrEqual(69);
    expect(result.band).toBe("needs_clarification");
    expect(result.bestMatch?.reasons.some((reason) => reason.includes("Product family keyword"))).toBe(
      false,
    );
  });

  it("Baklava tin 400gm with identity is eligible for suggested or auto-highlight", () => {
    const signals = extractProductResolutionTextSignals("Baklava tin 400gm", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-baklava",
          name: "Assorted Baklava 400gm Tin",
          sku: "BK-400",
          net_weight_grams: 400,
          pack_size: "400gm tin",
          category: "Baklava",
        }),
      ],
    });

    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
    expect(["suggested", "auto_highlight"]).toContain(result.band);
    expect(
      result.bestMatch?.reasons.some((reason) => reason.includes("Product family keyword")),
    ).toBe(true);
  });

  it("Mamoul gift box with identity is eligible for suggested or auto-highlight", () => {
    const signals = extractProductResolutionTextSignals("Mamoul gift box", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-mamoul",
          name: "Maamoul Dates Gift Box",
          sku: "MM-GIFT",
          pack_size: "gift box",
          category: "Maamoul",
        }),
      ],
    });

    expect(signals.aliasCandidates.map((value) => value.toLowerCase())).toEqual(
      expect.arrayContaining(["mamoul"]),
    );
    expect(signals.aliasCandidates.map((value) => value.toLowerCase())).not.toEqual(
      expect.arrayContaining(["gift box"]),
    );
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(70);
    expect(result.band).not.toBe("needs_clarification");
    expect(
      result.bestMatch?.reasons.some((reason) => reason.includes("Product family keyword")),
    ).toBe(true);
  });

  it("order updates message does not score dates family keyword on Premium Dates Box", () => {
    const signals = extractProductResolutionTextSignals("Please send order updates by Friday", "");
    const result = scoreProductResolutionCandidates({
      signals,
      products: [
        product({
          id: "p-dates",
          name: "Premium Dates Box",
          sku: "DT-1",
          category: "Dates",
        }),
      ],
    });

    expect(signals.catalogKeywords).toEqual([]);
    expect(result.bestMatch).toBeNull();
    expect(result.band).toBe("needs_clarification");
  });
});
