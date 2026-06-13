import { describe, expect, it } from "vitest";
import {
  NUTRITION_QA_WARNING,
  nutritionReviewStatusForSource,
  PLACEHOLDER_NUTRITION_TEMPLATE,
} from "@/lib/productNutritionPlaceholder";

describe("productNutritionPlaceholder", () => {
  it("marks placeholder nutrition as requiring QA review", () => {
    expect(nutritionReviewStatusForSource("placeholder_template")).toBe("requires_qa_fssai_review");
    expect(nutritionReviewStatusForSource("manual")).toBe("manual");
  });

  it("includes explicit placeholder warning copy", () => {
    expect(PLACEHOLDER_NUTRITION_TEMPLATE).toContain("PLACEHOLDER");
    expect(NUTRITION_QA_WARNING).toContain("QA/FSSAI");
  });
});
