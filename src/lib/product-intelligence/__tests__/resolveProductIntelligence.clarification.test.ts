import { describe, expect, it } from "vitest";
import { PROTOTYPE_APPROVED_CATALOG } from "../fixtures/prototypeCatalog";
import { resolveProductIntelligence } from "../resolveProductIntelligence";
import type { ApprovedAliasCatalog } from "../types";

const BASE_PRODUCT = {
  pack_size: null,
  net_weight_grams: null,
  uom: null,
  category: null,
  sub_category: null,
};

function miniCatalog(
  products: ApprovedAliasCatalog["products"],
  aliases: ApprovedAliasCatalog["aliases"] = [],
): ApprovedAliasCatalog {
  return {
    products,
    aliases,
    loaded_at: "2026-06-10T00:00:00.000Z",
    product_count: products.length,
    alias_count: aliases.length,
    catalog_complete: true,
  };
}

describe("resolveProductIntelligence clarification policy", () => {
  it("requires clarification when best confidence is below the 85% auto-resolve threshold", () => {
    const catalog = miniCatalog([
      {
        id: "p-weak",
        name: "Weak Alias Product",
        sku: "WEAK-1",
        ...BASE_PRODUCT,
        approved_aliases: ["xyz"],
      },
    ]);

    const result = resolveProductIntelligence(catalog, "xyz");

    expect(result.best_match?.confidence).toBe(83);
    expect(result.clarification_required).toBe(true);
  });

  it("may auto-resolve when best confidence meets the 85% auto-resolve threshold", () => {
    const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Need Pistachio Pyramid");

    expect(result.best_match?.confidence).toBeGreaterThanOrEqual(85);
    expect(result.clarification_required).toBe(false);
  });

  it("caps all candidate confidences on generic-only utterances before ranking", () => {
    const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Need Baklava");

    expect(result.clarification_required).toBe(true);
    expect(result.candidate_products.length).toBeGreaterThan(1);

    for (const candidate of result.candidate_products) {
      expect(candidate.confidence).toBeLessThanOrEqual(55);
    }

    const confidences = result.candidate_products.map((c) => c.confidence);
    for (let i = 1; i < confidences.length; i++) {
      expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i]!);
    }
  });

  it("auto-resolves strong multi-word approved aliases even when every token is generic-family", () => {
    const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Assorted Baklava");

    expect(result.clarification_required).toBe(false);
    expect(result.best_match?.productId).toBe("p-bak-1");
    expect(result.best_match?.confidence).toBeGreaterThanOrEqual(85);
    expect(result.best_match?.matched_aliases).toContain("Assorted Baklava");
  });

  it("still clarifies bare generic-family terms without a strong approved alias", () => {
    for (const utterance of ["Baklava", "Need Baklava"]) {
      const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, utterance);
      expect(result.clarification_required).toBe(true);
      for (const candidate of result.candidate_products) {
        expect(candidate.confidence).toBeLessThanOrEqual(55);
      }
    }
  });

  it("still clarifies single-token Asiyah without a strong approved alias", () => {
    const result = resolveProductIntelligence(PROTOTYPE_APPROVED_CATALOG, "Need Asiyah");

    expect(result.clarification_required).toBe(true);
    expect(result.candidate_products.length).toBeGreaterThan(1);
    for (const candidate of result.candidate_products) {
      expect(candidate.confidence).toBeLessThanOrEqual(55);
    }
  });

  it("resolves legacy product_aliases rows with null product_id via canonical_name product match", () => {
    const catalog = miniCatalog(
      [
        {
          id: "p-legacy-bak",
          name: "Assorted Baklava Tin",
          sku: "LEG-BAK-1",
          ...BASE_PRODUCT,
          approved_aliases: [],
        },
      ],
      [
        {
          alias_text: "Assorted Baklava",
          canonical_name: "Assorted Baklava Tin",
          product_id: null,
        },
      ],
    );

    const result = resolveProductIntelligence(catalog, "Assorted Baklava");

    expect(result.clarification_required).toBe(false);
    expect(result.best_match?.productId).toBe("p-legacy-bak");
    expect(result.best_match?.matched_aliases).toContain("Assorted Baklava");
  });

  it("requires clarification when null product_id canonical_name matches multiple products", () => {
    const catalog = miniCatalog(
      [
        {
          id: "p-dup-a",
          name: "Shared Asiyah Pack",
          sku: "SH-A",
          ...BASE_PRODUCT,
          approved_aliases: [],
        },
        {
          id: "p-dup-b",
          name: "Shared Asiyah Pack",
          sku: "SH-B",
          ...BASE_PRODUCT,
          approved_aliases: [],
        },
      ],
      [
        {
          alias_text: "Shared Asiyah",
          canonical_name: "Shared Asiyah Pack",
          product_id: null,
        },
      ],
    );

    const result = resolveProductIntelligence(catalog, "Shared Asiyah");

    expect(result.clarification_required).toBe(true);
    expect(result.candidate_products.filter((c) => c.confidence >= 70).length).toBeGreaterThan(1);
  });
});
