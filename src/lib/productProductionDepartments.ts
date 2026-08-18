/**
 * Canonical production_department values enforced by live DB
 * `products_production_department_check` on oasis-baklawa (tcxvcatsqqertcnycuop),
 * widened by oasis-supabase-core's 20260817090000_rgs_department_taxonomy.sql
 * to add `dates` and `semi_prepared` alongside the original six, then
 * corrected by 20260818090000_rgs_six_tv_department_correction.sql (Central
 * issue #368). `dragees`, `dates` and `semi_prepared` remain distinct raw
 * values here (no existing data renamed) even though
 * `canonical_production_department()` maps them under
 * CHOCOLATES_CONFECTIONERY / FUSION_SWEETS / ARABIC_SWEETS respectively for
 * RGS/Production authority -- see tvGroupOf() below for the client-side
 * mirror of that grouping.
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

/**
 * Groups raw production_department values into the owner's six-TV estate
 * (Central issue #368 / oasis-supabase-core's
 * 20260818090000_rgs_six_tv_department_correction.sql). Multiple raw values
 * can share one TV: dragees shares Chocolates & Confectionery's TV, dates
 * shares Fusion Sweets' TV, semi_prepared shares Arabic Sweets' TV. This is
 * the client-side mirror of Core's canonical_production_department() -- keep
 * both in sync by hand.
 */
const RAW_VALUE_TO_TV_GROUP: Record<ProductProductionDepartment, string> = {
  arabic_sweets: "ARABIC_SWEETS",
  semi_prepared: "ARABIC_SWEETS",
  chocolates_confectionery: "CHOCOLATES_CONFECTIONERY",
  dragees: "CHOCOLATES_CONFECTIONERY",
  fusion_sweets: "FUSION_SWEETS",
  dates: "FUSION_SWEETS",
  seasoned_nuts_mixes: "SEASONED_NUTS_MIXES",
  bakery: "BAKERY",
};

export function tvGroupOf(value: string | null | undefined): string | null {
  const normalized = normalizeProductProductionDepartment(value);
  return normalized ? RAW_VALUE_TO_TV_GROUP[normalized] : null;
}

/**
 * Factory TV / production routing filter match. Compares by TV group (not
 * raw value), so a Fusion Sweets TV filter also matches dates jobs and a
 * Chocolates & Confectionery TV filter also matches dragees jobs.
 */
export function productionDepartmentMatchesFilter(
  filter: string | null | undefined,
  productDepartment: string | null | undefined,
): boolean {
  const filterGroup = tvGroupOf(filter);
  const productGroup = tvGroupOf(productDepartment);
  if (!filterGroup || !productGroup) return false;
  return filterGroup === productGroup;
}
