/**
 * Triad Flow Classifier
 * Classifies order items into 3 parallel peer workflows:
 * - FLOW_FGS: Food items → 6 Production Handhelds (Arabic, Bakery, Chocolate, Dragees, Fusion, Nuts)
 * - FLOW_ASSEMBLY: Hampers/Gifts → Assembly Handheld (pulls from FGS + 3PCS)
 * - FLOW_3PCS: Non-food/external items → 3rd Party / External procurement
 */

export type TriadFlow = "FLOW_FGS" | "FLOW_ASSEMBLY" | "FLOW_3PCS";

// FGS food production departments (case-insensitive match)
const FGS_DEPARTMENTS = [
  "arabic sweets", "arabic", "arabic_sweets",
  "bakery",
  "chocolate", "chocolates", "chocolates_confectionery",
  "dragees",
  "fusion sweets", "fusion", "fusion_sweets",
  "nuts", "nuts_mixes", "seasoned_nuts_mixes", "seasoned nuts", "nuts roasting", "seasoned nuts & mixes",
];

// Assembly departments
const ASSEMBLY_DEPARTMENTS = [
  "packing & assembly", "assembly", "hampers", "gifts", "packing_assembly",
];

// Map raw department to production_jobs department key
export const DEPT_TO_JOB_KEY: Record<string, string> = {
  "arabic sweets": "arabic_sweets",
  "arabic": "arabic_sweets",
  "arabic_sweets": "arabic_sweets",
  "bakery": "bakery",
  "chocolate": "chocolate",
  "chocolates": "chocolate",
  "chocolates_confectionery": "chocolate",
  "dragees": "dragees",
  "fusion sweets": "fusion_sweets",
  "fusion": "fusion_sweets",
  "fusion_sweets": "fusion_sweets",
  "nuts": "nuts_mixes",
  "nuts_mixes": "nuts_mixes",
  "seasoned_nuts_mixes": "nuts_mixes",
  "seasoned nuts": "nuts_mixes",
  "nuts roasting": "nuts_mixes",
  "seasoned nuts & mixes": "nuts_mixes",
};

export function classifyFlow(productionDepartment: string | null | undefined): TriadFlow {
  if (!productionDepartment) return "FLOW_FGS"; // Default: food items (majority of catalog)
  const norm = productionDepartment.toLowerCase().trim();

  if (FGS_DEPARTMENTS.includes(norm)) return "FLOW_FGS";
  if (ASSEMBLY_DEPARTMENTS.includes(norm)) return "FLOW_ASSEMBLY";
  return "FLOW_3PCS";
}

export function mapToJobDept(raw: string | null | undefined): string {
  if (!raw) return "arabic_sweets";
  return DEPT_TO_JOB_KEY[raw.toLowerCase().trim()] || "arabic_sweets";
}

export function isFGSDept(raw: string | null | undefined): boolean {
  return classifyFlow(raw) === "FLOW_FGS";
}

export function isAssemblyDept(raw: string | null | undefined): boolean {
  return classifyFlow(raw) === "FLOW_ASSEMBLY";
}

export function is3PCSDept(raw: string | null | undefined): boolean {
  return classifyFlow(raw) === "FLOW_3PCS";
}

/**
 * Check if ALL items in an order have completed their respective flows.
 * Returns true only when every item across all 3 flows is "completed".
 */
export function isOrderFullyReady(items: Array<{ production_status: string | null }>): boolean {
  if (items.length === 0) return false;
  return items.every(item => item.production_status === "completed");
}
