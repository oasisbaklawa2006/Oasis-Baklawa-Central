import { describe, expect, it } from "vitest";
import {
  applyCartonTypeFromPacks,
  deriveAutoCartonType,
  isFormDirty,
  isPlaceholderNutritionFacts,
  nutritionReviewStatusFromFacts,
  shouldApplyLoadedProduct,
  shouldSkipUrlProductRestore,
} from "@/lib/adminProductFormState";
import { PLACEHOLDER_NUTRITION_TEMPLATE } from "@/lib/productNutritionPlaceholder";

describe("adminProductFormState", () => {
  it("derives carton type from packs count", () => {
    expect(deriveAutoCartonType(6)).toBe("Medium Master (6 Box)");
  });

  it("auto-fills carton only when blank", () => {
    const filled = applyCartonTypeFromPacks({
      packs_per_master_carton: "6",
      carton_type: "",
    });
    expect(filled.carton_type).toBe("Medium Master (6 Box)");
  });

  it("does not overwrite custom carton_type", () => {
    const custom = applyCartonTypeFromPacks({
      packs_per_master_carton: "6",
      carton_type: "Custom Export Carton",
    });
    expect(custom.carton_type).toBe("Custom Export Carton");
  });

  it("detects placeholder nutrition and review status on reload", () => {
    expect(isPlaceholderNutritionFacts(PLACEHOLDER_NUTRITION_TEMPLATE)).toBe(true);
    expect(nutritionReviewStatusFromFacts(PLACEHOLDER_NUTRITION_TEMPLATE)).toBe(
      "requires_qa_fssai_review",
    );
    expect(nutritionReviewStatusFromFacts("Per 100g: Energy 400kcal")).toBe("manual");
  });

  it("tracks dirty when form JSON differs from baseline", () => {
    const baseline = JSON.stringify({ is_active: true, dietary_tags: [], visible_in_catalog: true });
    expect(isFormDirty({ is_active: false, dietary_tags: [], visible_in_catalog: true }, baseline)).toBe(true);
    expect(isFormDirty({ is_active: true, dietary_tags: ["Vegan"], visible_in_catalog: true }, baseline)).toBe(true);
    expect(isFormDirty({ is_active: true, dietary_tags: [], visible_in_catalog: false }, baseline)).toBe(true);
    expect(isFormDirty({ is_active: true, dietary_tags: [], visible_in_catalog: true }, baseline)).toBe(false);
  });

  it("ignores stale async load completions", () => {
    expect(shouldApplyLoadedProduct(1, 1)).toBe(true);
    expect(shouldApplyLoadedProduct(1, 2)).toBe(false);
  });

  it("skips URL restore when product already loading or loaded", () => {
    expect(
      shouldSkipUrlProductRestore({
        productId: "abc",
        loading: false,
        productExists: true,
        editingProductId: "abc",
        loadingProductId: null,
      }),
    ).toBe(true);
    expect(
      shouldSkipUrlProductRestore({
        productId: "abc",
        loading: false,
        productExists: true,
        editingProductId: null,
        loadingProductId: "abc",
      }),
    ).toBe(true);
    expect(
      shouldSkipUrlProductRestore({
        productId: "abc",
        loading: false,
        productExists: true,
        editingProductId: null,
        loadingProductId: null,
      }),
    ).toBe(false);
  });
});
