import { describe, expect, it } from "vitest";
import {
  buildProductResolutionCombinedText,
  extractPieceCountTokens,
  extractProductResolutionTextSignals,
  extractQuantityReferences,
  extractWeightTokens,
  productNameMatchesTerm,
} from "@/lib/wa-governance/productResolutionSignals";

describe("productResolutionSignals", () => {
  it("extracts product keywords and quantities from sample messages", () => {
    const signals = extractProductResolutionTextSignals(
      "Need 25 baklava tins and 50 assorted 400gm",
      "Send 3 cartons Turkish Delight",
    );

    expect(signals.catalogKeywords.map((value) => value.toLowerCase())).toEqual(
      expect.arrayContaining(["baklava", "turkish delight"]),
    );
    expect(signals.catalogKeywords.map((value) => value.toLowerCase())).not.toEqual(
      expect.arrayContaining(["tin", "assorted"]),
    );
    expect(signals.aliasCandidates.map((value) => value.toLowerCase())).not.toEqual(
      expect.arrayContaining(["tin"]),
    );
    expect(signals.weightTokens).toEqual(expect.arrayContaining(["400gm"]));
    expect(signals.packFormatTokens).toEqual(expect.arrayContaining(["tin", "carton"]));
    expect(signals.quantityReferences).toEqual(
      expect.arrayContaining([
        { quantity: 25, unit: "tins" },
        { quantity: 3, unit: "cartons" },
      ]),
    );
  });

  it("extracts piece counts and weight grams", () => {
    expect(extractPieceCountTokens("Need 24 pc acrylic gift boxes")).toEqual({
      tokens: ["24pc"],
      counts: [24],
    });
    expect(extractWeightTokens("2kg Baklawa and 500 gm Mamoul")).toEqual({
      tokens: expect.arrayContaining(["2kg", "500gm"]),
      grams: expect.arrayContaining([2000, 500]),
    });
  });

  it("builds combined text from snippet and stitched body", () => {
    expect(buildProductResolutionCombinedText("Need 100 chocolate trays", "Follow-up note")).toBe(
      "Need 100 chocolate trays\nFollow-up note",
    );
  });

  it("extracts quantity references with units", () => {
    expect(extractQuantityReferences("100 pcs and 12 cases of dates")).toEqual(
      expect.arrayContaining([
        { quantity: 100, unit: "pcs" },
        { quantity: 12, unit: "cases" },
      ]),
    );
  });

  it("matches product names by exact and partial terms", () => {
    expect(productNameMatchesTerm("Assorted Baklawa 400gm Tin", "Baklawa")).toBe(true);
    expect(productNameMatchesTerm("Chocolate Dragees Box", "Turkish Delight")).toBe(false);
  });
});
