import {
  PLACEHOLDER_NUTRITION_TEMPLATE,
  type NutritionReviewStatus,
} from "@/lib/productNutritionPlaceholder";

export function deriveAutoCartonType(packs: number): string {
  if (!Number.isFinite(packs) || packs <= 0) return "";
  let autoCarton = `${packs} Box`;
  if (packs <= 4) autoCarton = `Small Master (${packs} Box)`;
  else if (packs <= 6) autoCarton = `Medium Master (${packs} Box)`;
  else if (packs <= 9) autoCarton = `Large Master (${packs} Box)`;
  else if (packs >= 12) autoCarton = `Jumbo Master (${packs} Box)`;
  return autoCarton;
}

export type CartonFormSlice = {
  packs_per_master_carton: string;
  carton_type: string;
};

/** Auto-fill carton_type from packs only when carton is blank — never overwrite custom values. */
export function applyCartonTypeFromPacks<T extends CartonFormSlice>(form: T): T {
  const trimmedCarton = (form.carton_type || "").trim();
  if (trimmedCarton) return form;
  const packs = Number(form.packs_per_master_carton);
  if (!Number.isFinite(packs) || packs <= 0) return form;
  return { ...form, carton_type: deriveAutoCartonType(packs) };
}

export function isPlaceholderNutritionFacts(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (trimmed === PLACEHOLDER_NUTRITION_TEMPLATE.trim()) return true;
  if (trimmed.includes("PLACEHOLDER — NOT PRODUCT-SPECIFIC")) return true;
  if (trimmed.includes("placeholder_template")) return true;
  if (trimmed.includes("requires QA/FSSAI verification")) return true;
  return false;
}

export function nutritionReviewStatusFromFacts(
  value: string | null | undefined,
): NutritionReviewStatus {
  return isPlaceholderNutritionFacts(value) ? "requires_qa_fssai_review" : "manual";
}

export function isFormDirty(next: Record<string, unknown>, baselineJson: string): boolean {
  return JSON.stringify(next) !== baselineJson;
}

export function shouldSkipUrlProductRestore(args: {
  productId: string | null;
  loading: boolean;
  productExists: boolean;
  editingProductId: string | null;
  loadingProductId: string | null;
}): boolean {
  if (!args.productId || args.loading) return true;
  if (!args.productExists) return true;
  if (args.editingProductId === args.productId) return true;
  if (args.loadingProductId === args.productId) return true;
  return false;
}

/** Ignore async load completions superseded by a newer load request. */
export function shouldApplyLoadedProduct(generation: number, currentGeneration: number): boolean {
  return generation === currentGeneration;
}
