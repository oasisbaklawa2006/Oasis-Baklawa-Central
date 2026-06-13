export type NutritionSource = "manual" | "placeholder_template" | "ai_generated";

export type NutritionReviewStatus = "manual" | "requires_qa_fssai_review";

export const PLACEHOLDER_NUTRITION_TEMPLATE = `Per 100g (PLACEHOLDER — NOT PRODUCT-SPECIFIC):
Energy: — kcal
Protein: — g
Carbohydrate: — g
Total Sugars: — g
Total Fat: — g
Saturated Fat: — g
Trans Fat: — g
Sodium: — mg

Source: placeholder_template
Review status: requires QA/FSSAI verification before catalogue publish.`;

export const NUTRITION_QA_WARNING =
  "Do not publish nutrition values without QA/FSSAI verification.";

export function nutritionReviewStatusForSource(source: NutritionSource): NutritionReviewStatus {
  return source === "manual" ? "manual" : "requires_qa_fssai_review";
}
