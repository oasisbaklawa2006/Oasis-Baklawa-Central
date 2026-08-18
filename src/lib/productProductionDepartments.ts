/**
 * Canonical production_department values enforced by live DB
 * `products_production_department_check` on oasis-baklawa (tcxvcatsqqertcnycuop),
 * widened by oasis-supabase-core's 20260817090000_rgs_department_taxonomy.sql
 * to add `dates` and `semi_prepared` alongside the original six. `dragees` and
 * `semi_prepared` remain distinct raw values here (no existing data renamed)
 * even though `canonical_production_department()` maps them under
 * CHOCOLATES_CONFECTIONERY / BAKERY_SEMI_PREPARED for RGS/Production authority.
 */
export const PRODUCT_PRODUCTION_DEPARTMENTS = [
  { value: "arabic_sweets", label: "Arabic Sweets" },
  { value: "chocolates_confectionery", label: "Chocolates & Confectionery" },
  { value: "bakery", label: "Bakery" },
  { value: "semi_prepared", label: "Semi-Prepared" },
  { value: "dragees", label: "Dragees" },
  { value: "fusion_sweets", label: "Fusion Sweets" },
  { value: "seasoned_nuts_mixes", label: "Seasoned Nuts & Mixes" },
  { value: "dates", label: "Dates" },
] as const;

export type ProductProductionDepartment =
  (typeof PRODUCT_PRODUCTION_DEPARTMENTS)[number]["value"];

const ALLOWED_SET = new Set<string>(
  PRODUCT_PRODUCTION_DEPARTMENTS.map((department) => department.value),
);

/** Legacy UI labels that must be normalized before insert/update. */
const LEGACY_LABEL_TO_VALUE: Record<string, ProductProductionDepartment> = {
  "arabic sweets": "arabic_sweets",
  chocolates: "chocolates_confectionery",
  chocolate: "chocolates_confectionery",
  "chocolates & confectionery": "chocolates_confectionery",
  bakery: "bakery",
  dragees: "dragees",
  "fusion sweets": "fusion_sweets",
  "seasoned nuts": "seasoned_nuts_mixes",
  "seasoned nuts & mixes": "seasoned_nuts_mixes",
  "nuts & mixes": "seasoned_nuts_mixes",
  "nuts roasting": "seasoned_nuts_mixes",
  dates: "dates",
  "semi-prepared": "semi_prepared",
  "semi prepared": "semi_prepared",
  semi_prepared: "semi_prepared",
};

export function isAllowedProductProductionDepartment(
  value: string | null | undefined,
): value is ProductProductionDepartment {
  return !!value && ALLOWED_SET.has(value);
}

export function normalizeProductProductionDepartment(
  value: string | null | undefined,
): ProductProductionDepartment | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (isAllowedProductProductionDepartment(trimmed)) return trimmed;
  const legacy = LEGACY_LABEL_TO_VALUE[trimmed.toLowerCase()];
  return legacy ?? null;
}

export function productProductionDepartmentLabel(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = normalizeProductProductionDepartment(value);
  if (normalized) {
    return PRODUCT_PRODUCTION_DEPARTMENTS.find((department) => department.value === normalized)?.label ?? normalized;
  }
  return value;
}

/** Canonical comparison for Factory TV / production routing filters vs product rows. */
export function productionDepartmentMatchesFilter(
  filter: string | null | undefined,
  productDepartment: string | null | undefined,
): boolean {
  const filterCanonical = normalizeProductProductionDepartment(filter);
  const productCanonical = normalizeProductProductionDepartment(productDepartment);
  if (!filterCanonical || !productCanonical) return false;
  return filterCanonical === productCanonical;
}
