import { describe, expect, it } from "vitest";
import { PROTOTYPE_APPROVED_CATALOG } from "../fixtures/prototypeCatalog";
import { resolveProductIntelligence } from "../resolveProductIntelligence";

describe("resolveProductIntelligence (prototype catalogue)", () => {
  const cases: Array<{
    utterance: string;
    expectClarification: boolean;
    expectProductId?: string;
    minConfidence?: number;
  }> = [
    {
      utterance: "Need 2 kg Kitta",
      expectClarification: false,
      expectProductId: "p-kitta",
      minConfidence: 85,
    },
    {
      utterance: "Send Mor Cashew Asiyah",
      expectClarification: false,
      expectProductId: "p-mor-asiyah",
      minConfidence: 85,
    },
    {
      utterance: "Need Pistachio Pyramid",
      expectClarification: false,
      expectProductId: "p-pist-pyr",
      minConfidence: 85,
    },
    {
      utterance: "Mix Nut Tart 500gm",
      expectClarification: false,
      expectProductId: "p-mix-tart",
      minConfidence: 85,
    },
    {
      utterance: "Coconut Durum 1 kg",
      expectClarification: false,
      expectProductId: "p-coc-durum",
      minConfidence: 85,
    },
    {
      utterance: "Need Asiyah",
      expectClarification: true,
    },
    {
      utterance: "Need Baklava",
      expectClarification: true,
    },
  ];

  it.each(cases)(
    "$utterance → clarification=$expectClarification",
    ({ utterance, expectClarification, expectProductId, minConfidence }) => {
      const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, utterance);

      expect(result.clarification_required).toBe(expectClarification);
      expect(result.explanation.length).toBeGreaterThan(10);

      if (expectProductId) {
        expect(result.best_match?.productId).toBe(expectProductId);
        if (minConfidence != null) {
          expect(result.best_match?.confidence ?? 0).toBeGreaterThanOrEqual(minConfidence);
        }
      }

      if (expectClarification) {
        expect(result.candidate_products.length).toBeGreaterThan(0);
      }
    },
  );

  it("returns ranked candidates with reasons", () => {
    const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Need Pistachio Pyramid");
    expect(result.candidate_products[0]?.reasons.length).toBeGreaterThan(0);
    expect(result.candidate_products[0]?.matched_aliases).toContain("Pistachio Pyramid");
  });

  it("does not mutate the catalogue", () => {
    const before = PROTOTYPE_APPROVED_CATALOG.product_count;
    resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Need Baklava");
    expect(PROTOTYPE_APPROVED_CATALOG.product_count).toBe(before);
  });
});
