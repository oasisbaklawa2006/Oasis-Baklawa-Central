/**
 * Department-specific execution fields for the common PHH completion form.
 * One shared shell, six department configurations -- not six separate apps.
 * Captured values are sent as record_production_output's p_execution_metadata
 * jsonb (see 20260817140000_rgs_department_execution_metadata.sql in
 * oasis-supabase-core), keyed by canonical department code so a payload can
 * never silently apply to the wrong department's schema.
 */

export type ExecutionField = {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
};

// Keyed by production_departments.code (oasis-supabase-core).
export const DEPARTMENT_EXECUTION_FIELDS: Record<string, ExecutionField[]> = {
  ARABIC_SWEETS: [
    { key: "nut_variant", label: "Nut variant", type: "text", placeholder: "e.g. Pistachio" },
    { key: "bake_stage", label: "Bake stage", type: "text", placeholder: "first_bake / second_bake / final_bake" },
    { key: "syrup_stage", label: "Syrup stage", type: "text", placeholder: "not_started / soaking / soaked" },
    { key: "breakage_qty", label: "Breakage qty", type: "number" },
  ],
  CHOCOLATES_CONFECTIONERY: [
    { key: "tempering_stage", label: "Tempering stage", type: "text" },
    { key: "coating_stage", label: "Coating stage", type: "text" },
    { key: "mould_batch", label: "Mould / batch", type: "text" },
  ],
  FUSION_SWEETS: [
    { key: "recipe_version", label: "Recipe version", type: "text" },
    { key: "cooking_stage", label: "Cooking stage", type: "text" },
    { key: "garnish", label: "Garnish", type: "text" },
  ],
  SEASONED_NUTS_MIXES: [
    { key: "roast_profile", label: "Roast profile", type: "text" },
    { key: "seasoning_batch", label: "Seasoning batch", type: "text" },
  ],
  DATES: [
    { key: "variety", label: "Date variety", type: "text" },
    { key: "grade", label: "Grade", type: "text" },
    { key: "filling", label: "Filling", type: "text" },
  ],
  BAKERY_SEMI_PREPARED: [
    { key: "dough_stage", label: "Dough stage", type: "text" },
    { key: "bake_stage", label: "Bake stage", type: "text" },
    { key: "freeze_stage", label: "Freeze stage", type: "text" },
    { key: "piece_count", label: "Piece count", type: "number" },
  ],
};

export function executionFieldsForDepartment(department: string | null | undefined): ExecutionField[] {
  if (!department) return [];
  return DEPARTMENT_EXECUTION_FIELDS[department.toUpperCase()] ?? [];
}
