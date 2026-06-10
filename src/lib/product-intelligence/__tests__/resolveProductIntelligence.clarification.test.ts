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
): ApprovedAliasCatalog {
  return {
    products,
    aliases: [],
    loaded_at: "2026-06-10T00:00:00.000Z",
    product_count: products.length,
    alias_count: 0,
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
});
