export interface ProductionJob {
  id: string;
  order_item_id: string | null;
  order_id: string | null;
  product_id: string | null;
  department: string;
  assigned_to: string | null;
  assigned_qty: number;
  produced_qty: number;
  wasted_qty: number;
  net_weight_per_unit: number;
  batch_number: string | null;
  priority: "normal" | "urgent" | "red";
  stage: "prep" | "processing" | "finishing" | "ready";
  status: string;
  rejection_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  locked: boolean;
  created_at: string | null;
  updated_at: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null; status: string } | null;
}

export interface PauseRecord {
  id: string;
  job_id: string;
  reason: string;
  comment: string | null;
  paused_at: string | null;
  resumed_at: string | null;
}

export interface DepartmentProduct {
  id: string;
  name: string;
  image_url: string | null;
  sku: string | null;
}

export const STAGE_ORDER = ["prep", "processing", "finishing", "ready"] as const;

export const STAGE_LABELS: Record<string, string> = {
  prep: "Prep",
  processing: "Processing",
  finishing: "Finishing",
  ready: "Ready",
};

export const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  red: { bg: "bg-red-500/20", text: "text-red-600", border: "border-red-500", label: "RED PRIORITY" },
  urgent: { bg: "bg-amber-500/20", text: "text-amber-600", border: "border-amber-500", label: "URGENT" },
  normal: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", label: "NORMAL" },
};

// Canonical department codes from oasis-supabase-core's production_departments
// master (see 20260817090000_rgs_department_taxonomy.sql). production_jobs
// created via create_production_shortage_demand always use these codes;
// the legacy lowercase strings (arabic_sweets, dragees, chocolate, ...) are
// reconciled server-side by canonical_production_department() but a job's
// own `department` column can carry either spelling historically, so PHH
// queries by `canonical_department` (trigger-maintained on every row) rather
// than by this raw string.
// Corrected per Central issue #368 (owner's six-TV estate) by
// oasis-supabase-core's 20260818090000_rgs_six_tv_department_correction.sql:
// semi_prepared -> ARABIC_SWEETS (not Bakery), dates -> FUSION_SWEETS (not a
// standalone Dates department), BAKERY_SEMI_PREPARED renamed to BAKERY
// (bakery-only). HOD_DATES/HOD_DRAGEES remain real, distinct roles that
// route into a shared department rather than owning one of their own.
export const HOD_DEPARTMENT_MAP: Record<string, string> = {
  HOD_ARABIC: "ARABIC_SWEETS",
  HOD_DRAGEES: "CHOCOLATES_CONFECTIONERY",
  HOD_FUSION: "FUSION_SWEETS",
  HOD_CHOCOLATE: "CHOCOLATES_CONFECTIONERY",
  HOD_BAKERY: "BAKERY",
  HOD_NUTS: "SEASONED_NUTS_MIXES",
  HOD_DATES: "FUSION_SWEETS",
  HOD_ASSEMBLY: "packing_assembly",
};

// Mirrors production_departments.legacy_values in
// 20260817090000_rgs_department_taxonomy.sql, corrected by
// 20260818090000_rgs_six_tv_department_correction.sql. Client-side
// convenience only -- the server-side canonical_production_department()
// function is the authority; this must stay in sync with it by hand.
const LEGACY_TO_CANONICAL_DEPARTMENT: Record<string, string> = {
  arabic_sweets: "ARABIC_SWEETS",
  chocolates_confectionery: "CHOCOLATES_CONFECTIONERY",
  dragees: "CHOCOLATES_CONFECTIONERY",
  fusion_sweets: "FUSION_SWEETS",
  seasoned_nuts_mixes: "SEASONED_NUTS_MIXES",
  dates: "FUSION_SWEETS",
  bakery: "BAKERY",
  semi_prepared: "ARABIC_SWEETS",
};

export function canonicalDepartmentOf(rawDepartment: string | null | undefined): string | null {
  if (!rawDepartment) return null;
  const key = rawDepartment.toLowerCase();
  if (LEGACY_TO_CANONICAL_DEPARTMENT[key]) return LEGACY_TO_CANONICAL_DEPARTMENT[key];
  const upper = rawDepartment.toUpperCase();
  return DEPARTMENTS.some((d) => d.value === upper) ? upper : null;
}

export const DEPARTMENTS = [
  { value: "ARABIC_SWEETS", label: "Arabic Sweets" },
  { value: "CHOCOLATES_CONFECTIONERY", label: "Chocolates & Confectionery" },
  { value: "FUSION_SWEETS", label: "Fusion Sweets" },
  { value: "SEASONED_NUTS_MIXES", label: "Seasoned Nuts & Mixes" },
  { value: "BAKERY", label: "Bakery" },
  { value: "packing_assembly", label: "Packing & Assembly" },
];
