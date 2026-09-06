/**
 * Point 87 — Production department execution canonical boundary (Central).
 *
 * Establishes the single Central execution workspace that consumes Core
 * `production_jobs` authority only. Point 86 owns queue creation/routing;
 * Point 88 owns targets/allocation/start-pause-complete controls where
 * separable; Point 89 owns wastage/rejection/shortage/QH governance.
 *
 * PR merged != Point 87 cleared — physical TV/handheld UAT remains a
 * separate Mission Control gate.
 */

export const POINT87_ASM_ID = "POINT87";

/** Governed relation — all execution reads/writes route through Core RPCs. */
export const POINT87_AUTHORITY_RELATION = "production_jobs";

/** Primary handheld execution surface (PHH Engine). */
export const POINT87_HANDHELD_ROUTE = "/operations-controller";

/**
 * Configured production departments and their canonical TV/read-only surfaces.
 * Dates and Dragees share Fusion and Chocolate TVs respectively per Core
 * taxonomy (20260818090000_rgs_six_tv_department_correction.sql).
 */
export const POINT87_DEPARTMENT_EXECUTION_CONTRACTS = [
  {
    canonicalDepartment: "ARABIC_SWEETS",
    label: "Arabic Sweets",
    tvRoute: "/tv/arabic-sweets",
    floorRoles: ["PROD_ARABIC_SWEETS", "HOD_ARABIC"],
    rawProductDepartments: ["arabic_sweets", "semi_prepared"],
  },
  {
    canonicalDepartment: "CHOCOLATES_CONFECTIONERY",
    label: "Chocolates & Confectionery",
    tvRoute: "/tv/chocolate",
    floorRoles: ["PROD_CHOCOLATE", "PROD_DRAGEES", "HOD_CHOCOLATE", "HOD_DRAGEES"],
    rawProductDepartments: ["chocolates_confectionery", "dragees"],
  },
  {
    canonicalDepartment: "FUSION_SWEETS",
    label: "Fusion Sweets",
    tvRoute: "/tv/fusion",
    floorRoles: ["PROD_FUSION", "HOD_FUSION", "HOD_DATES"],
    rawProductDepartments: ["fusion_sweets", "dates"],
  },
  {
    canonicalDepartment: "SEASONED_NUTS_MIXES",
    label: "Seasoned Nuts & Mixes",
    tvRoute: "/tv/nuts",
    floorRoles: ["PROD_NUTS", "HOD_NUTS"],
    rawProductDepartments: ["seasoned_nuts_mixes"],
  },
  {
    canonicalDepartment: "BAKERY",
    label: "Bakery",
    tvRoute: "/tv/bakery",
    floorRoles: ["PROD_BAKERY", "HOD_BAKERY"],
    rawProductDepartments: ["bakery"],
  },
] as const;

export type Point87CanonicalDepartment =
  (typeof POINT87_DEPARTMENT_EXECUTION_CONTRACTS)[number]["canonicalDepartment"];

/** Read-only TV routes — no mutation RPCs permitted on these surfaces. */
export const POINT87_TV_ROUTES = POINT87_DEPARTMENT_EXECUTION_CONTRACTS.map(
  (contract) => contract.tvRoute,
);

/** Legacy execution-board URLs quarantined to the canonical handheld surface. */
export const POINT87_LEGACY_PRODUCTION_REDIRECTS: ReadonlyArray<{
  legacyRoute: string;
  canonicalTarget: string;
}> = [
  { legacyRoute: "/admin/execution/production", canonicalTarget: POINT87_HANDHELD_ROUTE },
];

/**
 * Governed Core RPCs consumed by the Point 87 PHH workspace. Direct table
 * INSERT/UPDATE/DELETE on production_jobs from Central is forbidden.
 */
export const POINT87_GOVERNED_RPC_ACTIONS = {
  jobIntake: ["accept_production_job", "reject_production_job"] as const,
  lifecycle: [
    "start_production_job",
    "pause_production_job",
    "resume_production_job",
    "advance_production_job_stage",
  ] as const,
  completionHandoff: [
    "record_production_output",
    "declare_production_ready",
    "dispatch_production_to_rgs",
  ] as const,
  issues: ["report_production_issue", "resolve_production_issue"] as const,
  quickLog: ["quick_log_production_to_rgs"] as const,
  dayEnd: ["submit_production_day_end"] as const,
  upstreamJobCreation: ["create_production_shortage_demand"] as const,
} as const;

/** Ordered completion handoff chain — each step must succeed before the next. */
export const POINT87_COMPLETION_HANDOFF_CHAIN = [
  "record_production_output",
  "declare_production_ready",
  "dispatch_production_to_rgs",
] as const;

/** Downstream RGS receipt (outside Point 87 execution, inside RGS custody). */
export const POINT87_RGS_RECEIPT_RPC = "accept_rgs_production_receipt";

/**
 * Surfaces that must NOT act as production execution authority. Retail and
 * complaints boards remain on operational_queue_items (dead projection) and
 * are outside Point 87 production-department scope.
 */
export const POINT87_COMPETING_LEGACY_SURFACES = [
  "/admin/execution/retail",
  "/admin/execution/complaints",
  "/admin/execution-command-center",
] as const;

/** Programme boundary markers — not implemented in this Central slice. */
export const POINT87_PROGRAMME_BOUNDARIES = {
  point86: {
    scope: "Automatic department queue creation/routing from orders",
    centralStatus: "NOT_OWNED",
    evidence: "operational_queue_items has zero Core writers; queue seeding RPC is a Core prerequisite.",
  },
  point88: {
    scope: "Department targets, allocation, start/pause/complete controls",
    centralStatus: "PARTIALLY_CONSUMED",
    evidence: "PHH lifecycle RPCs exist; targets/allocation authority remains a separate Point 88 slice.",
  },
  point89: {
    scope: "Wastage, rejection, shortage, QH governance",
    centralStatus: "NOT_OWNED",
    evidence: "Exception/QH governance is a separate Point 89 slice; PHH reports issues only.",
  },
} as const;

export function point87CanonicalDepartments(): Point87CanonicalDepartment[] {
  return POINT87_DEPARTMENT_EXECUTION_CONTRACTS.map((c) => c.canonicalDepartment);
}

export function point87ContractForDepartment(
  department: string,
): (typeof POINT87_DEPARTMENT_EXECUTION_CONTRACTS)[number] | null {
  const upper = department.toUpperCase();
  return (
    POINT87_DEPARTMENT_EXECUTION_CONTRACTS.find((c) => c.canonicalDepartment === upper) ?? null
  );
}

export function point87TvRouteForDepartment(department: string): string | null {
  return point87ContractForDepartment(department)?.tvRoute ?? null;
}

export function isPoint87CanonicalRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === POINT87_HANDHELD_ROUTE) return true;
  return POINT87_TV_ROUTES.includes(normalized as (typeof POINT87_TV_ROUTES)[number]);
}

export function isPoint87LegacyProductionRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return POINT87_LEGACY_PRODUCTION_REDIRECTS.some((r) => r.legacyRoute === normalized);
}

export function point87LegacyRedirectTarget(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    POINT87_LEGACY_PRODUCTION_REDIRECTS.find((r) => r.legacyRoute === normalized)?.canonicalTarget ??
    null
  );
}

/** All governed RPC names used anywhere in the Point 87 execution workspace. */
export function point87AllGovernedRpcs(): string[] {
  return [
    ...POINT87_GOVERNED_RPC_ACTIONS.jobIntake,
    ...POINT87_GOVERNED_RPC_ACTIONS.lifecycle,
    ...POINT87_GOVERNED_RPC_ACTIONS.completionHandoff,
    ...POINT87_GOVERNED_RPC_ACTIONS.issues,
    ...POINT87_GOVERNED_RPC_ACTIONS.quickLog,
    ...POINT87_GOVERNED_RPC_ACTIONS.dayEnd,
    ...POINT87_GOVERNED_RPC_ACTIONS.upstreamJobCreation,
  ];
}

/**
 * Department isolation: a job bound to one canonical department must only
 * appear on that department's PHH queue and TV surface.
 */
export function point87DepartmentIsolationMatch(
  jobCanonicalDepartment: string,
  surfaceDepartment: string,
): boolean {
  return jobCanonicalDepartment.toUpperCase() === surfaceDepartment.toUpperCase();
}

/** TV surfaces are read-only — no governed RPC may be invoked from them. */
export const POINT87_TV_READ_ONLY_RPC_DENYLIST = point87AllGovernedRpcs();
