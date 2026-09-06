/**
 * Factory Operations Route Registry — Authoritative route definitions
 *
 * CORRECTED per independent verification (see route-source-reconciliation
 * test): the first version of this file (1) undercounted/omitted real
 * routes, (2) invented role names that do not exist anywhere in
 * auth-routing.ts or App.tsx, and (3) conflated "who this route defaults
 * to on login" (STAFF_ROLE_DESTINATIONS in auth-routing.ts) with "who the
 * route guard technically admits" (RoleProtectedRoute allowedRoles, or the
 * single shared ADMIN_STAFF_ROLES gate that every /admin/* route sits
 * behind). Those are two different things and must not be merged into one
 * `allowedRoles` field.
 *
 * ACCESS CONTROL REALITY (verified directly against src/App.tsx):
 * - Every route under `/admin/*` shares ONE gate: the `/admin` parent
 *   route's `RoleProtectedRoute allowedRoles={[...ADMIN_STAFF_ROLES]}`.
 *   There is no per-route role restriction for ready-goods, assembly,
 *   dispatch, inventory, 3PGS, or trace screens -- any role in
 *   ADMIN_STAFF_ROLES can technically load any of them.
 * - `/tv/*` routes, `/operations-controller`, and `/security-gate` sit
 *   OUTSIDE `/admin` and each carries its own explicit, narrower
 *   `RoleProtectedRoute allowedRoles={[...]}`.
 * - `technicallyAllowedRoles` below reflects the REAL route guard.
 * - `intendedPrimaryAudience` reflects who `STAFF_ROLE_DESTINATIONS`
 *   (src/lib/auth-routing.ts) actually lands on that route by default, or
 *   (where no role defaults there) the role whose job function the screen
 *   was built for. Certification must test real access control
 *   (`technicallyAllowedRoles`) separately from navigation intent
 *   (`intendedPrimaryAudience`) -- they are not the same claim.
 *
 * ROLE AUTHORITY: every role name below is verified present in
 * src/lib/auth-routing.ts (`STAFF_ROLE_DESTINATIONS`) and/or
 * src/App.tsx (`ADMIN_STAFF_ROLES`, or a route's own `allowedRoles`).
 * Conceptual roles invented in the first version of this registry
 * (INVENTORY_MANAGER, INVENTORY_RECEIVING, PROCUREMENT_MANAGER,
 * TRACE_ANALYST, PACKING_MANAGER, DISPATCH_HEAD's siblings, etc. that do
 * not exist) have been removed; see ROLE_NOT_IMPLEMENTED below for the
 * full list and what real role, if any, actually covers that function.
 *
 * Used by:
 * - Route registry validator test (route-source-reconciliation)
 * - Comprehensive certification harness
 * - Documentation generation
 *
 * DO NOT maintain separate hand-written copies of this data. If App.tsx's
 * route table changes, update this file in the same PR and re-run the
 * reconciliation test.
 */

export type FactorySubsystem =
  | "PRODUCTION_EXECUTION"
  | "TV_NETWORK"
  | "RGS_STORAGE"
  | "ASSEMBLY_PACKING"
  | "DISPATCH"
  | "INVENTORY"
  | "3PGS_THIRD_PARTY"
  | "TRACE_DISPLAY";

export type FactoryRouteStatus =
  /** Actively used, real governed data, in scope for certification */
  | "FACTORY_CURRENT"
  /** Reads a table with zero writers (dead data); not redirected yet */
  | "FACTORY_LEGACY"
  /** Self-labeled or otherwise confirmed as an unvalidated internal preview */
  | "FACTORY_PREVIEW"
  /** Touches Factory-adjacent data but is a broader, cross-department screen */
  | "FACTORY_RELATED_BUT_OUT_OF_SCOPE"
  /** Route redirects to a canonical Factory surface */
  | "LEGACY_REDIRECT";

/**
 * The single role list every `/admin/*` route is actually gated by, per
 * `ADMIN_STAFF_ROLES` in src/App.tsx (transcribed verbatim; the
 * reconciliation test re-derives this from the source file and fails on
 * drift rather than trusting this copy blindly).
 */
export const ADMIN_STAFF_ROLES_REFERENCE = [
  "SUPER_ADMIN", "ADMIN",
  "FINANCE_HEAD", "FINANCE_EXEC",
  "OPERATIONS_MANAGER", "PRODUCTION_MANAGER",
  "HOD_ARABIC", "HOD_FUSION", "HOD_CHOCOLATE", "HOD_BAKERY", "HOD_NUTS", "HOD_ASSEMBLY", "HOD_DRAGEES", "HOD_DATES",
  "STORE_INCHARGE", "DISPATCH_MANAGER", "DISPATCH_INCHARGE", "SECURITY_CONTROL",
  "SUPPORT_EXECUTIVE",
  "DISPATCH_HEAD", "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR",
  "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY", "RGS_ADMIN",
  "PROD_ARABIC_SWEETS", "PROD_CHOCOLATE", "PROD_DRAGEES", "PROD_FUSION", "PROD_DATES", "PROD_BAKERY", "PROD_NUTS",
  "TV_DISPLAY", "TV_ASSEMBLY", "TV_READY",
  "CATALOGUE_CONTRIBUTOR",
] as const;

/**
 * Conceptual roles from the first (incorrect) version of this registry
 * that do NOT exist in auth-routing.ts or App.tsx. Do not use these in
 * any certification test or credential matrix.
 */
export const ROLE_NOT_IMPLEMENTED: Record<string, string> = {
  INVENTORY_MANAGER: "No such role exists. Inventory screens are gated by the shared ADMIN_STAFF_ROLES set (no dedicated inventory role); use ADMIN or a relevant HOD/STORE role for certification instead.",
  INVENTORY_RECEIVING: "No such role exists. Same as INVENTORY_MANAGER -- covered by ADMIN_STAFF_ROLES generally, no dedicated role.",
  PROCUREMENT_MANAGER: "No such role exists. 3PGS procurement is reachable by ADMIN_STAFF_ROLES generally; STORE_3RD_PARTY is the closest real role with an intended-audience claim on 3PGS screens.",
  TRACE_ANALYST: "No such role exists. Trace/label/carton screens have no dedicated role; reachable by ADMIN_STAFF_ROLES generally.",
  PACKING_MANAGER: "No such role exists. The real role is PACKING_SUPERVISOR (defaults to /admin/order-management, not a label/trace screen).",
};

export type FactoryRouteEntry = {
  /** Normalized route path (e.g., "/operations-controller") */
  route: string;
  /** Descriptive label */
  label: string;
  /** Which Factory subsystem this belongs to */
  subsystem: FactorySubsystem;
  /**
   * Roles the actual route guard admits (verified against RoleProtectedRoute
   * allowedRoles, or ADMIN_STAFF_ROLES_REFERENCE for /admin/* routes).
   */
  technicallyAllowedRoles: readonly string[];
  /**
   * Role(s) this screen is built for / that STAFF_ROLE_DESTINATIONS
   * defaults onto this route. May be a strict subset of
   * technicallyAllowedRoles. Empty array if no role defaults here and no
   * clear primary-audience role could be established.
   */
  intendedPrimaryAudience: readonly string[];
  status: FactoryRouteStatus;
  /** If status is LEGACY_REDIRECT, where does this redirect to? */
  legacyRedirectTarget?: string;
  /** Device class: "DESKTOP" | "TV" | "BOTH" */
  deviceClass: "DESKTOP" | "TV" | "BOTH";
  /** Evidence for the status classification */
  evidence: string;
};

/**
 * Authoritative Factory Operations route registry.
 * Derived from src/App.tsx route table + src/lib/auth-routing.ts.
 * Last verified: 2026-08-26 (post source-vs-registry correction).
 */
export const FACTORY_OPERATIONS_ROUTES: FactoryRouteEntry[] = [
  // ── PRODUCTION EXECUTION ──────────────────────────────────────────────
  {
    route: "/operations-controller",
    label: "Production Operations Controller (handheld)",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["PRODUCTION_MANAGER", "HOD_ARABIC", "HOD_CHOCOLATE", "HOD_DRAGEES", "HOD_FUSION", "HOD_DATES", "HOD_BAKERY", "HOD_NUTS", "OPERATIONS_MANAGER"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line ~242: own RoleProtectedRoute allowedRoles=[...ADMIN_STAFF_ROLES]; auth-routing.ts defaults all Production Manager/HOD roles here.",
  },
  {
    route: "/security-gate",
    label: "Security Gate Checkpoint",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ["GATE_SECURITY", "SECURITY_CONTROL", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["GATE_SECURITY", "SECURITY_CONTROL"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: own explicit RoleProtectedRoute, narrower than ADMIN_STAFF_ROLES.",
  },

  // ── TV NETWORK ─────────────────────────────────────────────────────────
  {
    route: "/tv/arabic-sweets",
    label: "Arabic Sweets Production TV",
    subsystem: "TV_NETWORK",
    technicallyAllowedRoles: ["HOD_ARABIC", "PROD_ARABIC_SWEETS", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["PROD_ARABIC_SWEETS"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 489. TV_DISPLAY is NOT in this route's allowedRoles (corrected from prior registry version -- TV_DISPLAY actually lands on /admin/cmd-war-room per auth-routing.ts).",
  },
  {
    route: "/tv/chocolate",
    label: "Chocolate & Confectionery Production TV (serves Dragees too)",
    subsystem: "TV_NETWORK",
    technicallyAllowedRoles: ["HOD_CHOCOLATE", "PROD_CHOCOLATE", "HOD_DRAGEES", "PROD_DRAGEES", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["PROD_CHOCOLATE", "PROD_DRAGEES"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 495. /tv/dragees redirects here (line 498).",
  },
  {
    route: "/tv/fusion",
    label: "Fusion Sweets Production TV (serves Dates too)",
    subsystem: "TV_NETWORK",
    technicallyAllowedRoles: ["HOD_FUSION", "PROD_FUSION", "HOD_DATES", "PROD_DATES", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["PROD_FUSION", "PROD_DATES"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 504.",
  },
  {
    route: "/tv/bakery",
    label: "Bakery Production TV",
    subsystem: "TV_NETWORK",
    technicallyAllowedRoles: ["HOD_BAKERY", "PROD_BAKERY", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["PROD_BAKERY"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 505.",
  },
  {
    route: "/tv/nuts",
    label: "Nuts & Dry Fruits Production TV",
    subsystem: "TV_NETWORK",
    technicallyAllowedRoles: ["HOD_NUTS", "PROD_NUTS", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["PROD_NUTS"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 506.",
  },
  {
    route: "/tv/rgs",
    label: "Ready Goods Store TV (canonical)",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ["STORE_READY_GOODS", "RGS_ADMIN", "TV_READY", "SUPER_ADMIN", "ADMIN"],
    intendedPrimaryAudience: ["TV_READY"],
    status: "FACTORY_CURRENT",
    deviceClass: "TV",
    evidence: "App.tsx line 514. TV_READY's dedicated kiosk route per auth-routing.ts.",
  },

  // ── RGS / READY GOODS STORAGE (admin) ──────────────────────────────────
  {
    route: "/admin/ready-goods",
    label: "Ready Goods Store Dashboard",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["STORE_INCHARGE", "STORE_READY_GOODS", "RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES; auth-routing.ts defaults STORE_INCHARGE/STORE_READY_GOODS/RGS_ADMIN here.",
  },
  {
    route: "/admin/ready-goods-stock",
    label: "Ready Goods Stock Ledger (RgsStockPosition)",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["STORE_READY_GOODS", "RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES; no explicit default-landing role, inferred from RGS domain.",
  },
  {
    route: "/admin/ready-goods-day-close",
    label: "Ready Goods Day Close",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },
  {
    route: "/admin/ready-goods-reports",
    label: "Ready Goods Reports",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },
  {
    route: "/admin/production-demand-planner",
    label: "Production Demand Planner",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["PRODUCTION_MANAGER", "RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. Subject of PR #404's PostgREST relationship fix.",
  },
  {
    route: "/admin/rgs-tv",
    label: "Ready Goods TV (legacy admin-path duplicate of /tv/rgs)",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_LEGACY",
    deviceClass: "TV",
    evidence: "App.tsx line 457: renders the SAME <ReadyGoodsTV /> component as /tv/rgs, but through the broad ADMIN_STAFF_ROLES gate instead of the TV-specific RoleProtectedRoute. No redirect exists; superseded by the canonical /tv/rgs kiosk route -- treated as a duplicate, not certified separately.",
  },

  // ── ASSEMBLY / PACKING ──────────────────────────────────────────────────
  {
    route: "/admin/assembly-tasks",
    label: "Assembly Task Management",
    subsystem: "ASSEMBLY_PACKING",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["HOD_ASSEMBLY", "ASSEMBLY_MANAGER"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES; auth-routing.ts defaults HOD_ASSEMBLY and ASSEMBLY_MANAGER here.",
  },
  {
    route: "/admin/assembly-tv",
    label: "Assembly Packing TV",
    subsystem: "ASSEMBLY_PACKING",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_PREVIEW",
    deviceClass: "BOTH",
    evidence: "auth-routing.ts comment: 'real, working live board (real Supabase queries, loading/error states) but self-labels as internal preview, not yet evidence-validated -- do not default-land any role there.' TV_ASSEMBLY/TV_DISPLAY explicitly land on /admin/cmd-war-room instead, not here.",
  },

  // ── DISPATCH ─────────────────────────────────────────────────────────────
  {
    route: "/admin/dispatch-mgmt",
    label: "Dispatch Management",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_HEAD", "DISPATCH_MANAGER", "DISPATCH_INCHARGE"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx (DispatchManagement component); auth-routing.ts defaults all three dispatch roles here. FACT-C3: rewired onto the governed b2b_dispatch_* RPC chain (create_b2b_dispatch_consignment through submit_b2b_dispatch_packing_list_to_finance) -- no direct writes to dispatch_cartons/order_items/packing_lists remain in this component. Absorbed the former /admin/dispatch-governed-preview capabilities; that route was retired.",
  },
  {
    route: "/admin/dispatch-readiness",
    label: "Dispatch Readiness Board",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_MANAGER", "DISPATCH_INCHARGE"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 459 (DispatchReadinessBoard, backed by @/lib/dispatch-readiness -- a real, distinct module, not operational_queue_items).",
  },
  {
    route: "/admin/dispatch-completion",
    label: "Dispatch Completion Board",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_MANAGER", "DISPATCH_INCHARGE"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 460 (DispatchCompletionBoard, backed by @/lib/dispatch-completion). Omitted from the first version of this registry -- confirmed real, not dead data.",
  },
  {
    route: "/admin/dispatch-finalization",
    label: "Dispatch Finalization Board",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_MANAGER", "DISPATCH_HEAD"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 461 (DispatchFinalizationBoard, backed by @/lib/dispatch-finalization). Omitted from the first version of this registry.",
  },
  {
    route: "/admin/stock-finalization",
    label: "Stock Finalization Board",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_MANAGER", "RGS_ADMIN"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 462 (StockFinalizationBoard); confirmed reading inventory_reservations directly (grep). Omitted from the first version of this registry.",
  },
  {
    route: "/admin/golden-chain-operator",
    label: "Golden Chain Operator Wizard (dispatch/finance orchestration)",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["DISPATCH_MANAGER"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 458 (GoldenChainOperatorWizard). Composes createDispatchReadinessBundle + createDispatchCompletionBundle + createDispatchFinalizationBundle + createFinanceGovernanceBundle -- a real orchestration wizard across the dispatch lifecycle boards above, not dead data. Its one finance-governance panel does not make the whole screen out-of-scope.",
  },
  {
    route: "/admin/dispatch-tv",
    label: "Dispatch Operation TV",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_PREVIEW",
    deviceClass: "BOTH",
    evidence: "Same auth-routing.ts comment as /admin/assembly-tv: 'internal preview, not yet evidence-validated.' TV_DISPLAY lands on /admin/cmd-war-room instead.",
  },

  // ── INVENTORY ────────────────────────────────────────────────────────────
  {
    route: "/admin/inventory-command-center",
    label: "Inventory Command Center",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. No dedicated 'inventory manager' role exists (see ROLE_NOT_IMPLEMENTED) -- reachable by any ADMIN_STAFF_ROLES member; no specific intended audience role identified.",
  },
  {
    route: "/admin/inventory-receiving",
    label: "Inventory Receiving & QC",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. See ROLE_NOT_IMPLEMENTED: no INVENTORY_RECEIVING role exists.",
  },
  {
    route: "/admin/carton-explorer",
    label: "Carton Explorer & Traceability",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. See ROLE_NOT_IMPLEMENTED: no TRACE_ANALYST role exists.",
  },
  {
    route: "/admin/scan-timeline",
    label: "Scan Timeline & History",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },
  {
    route: "/admin/reservation-board",
    label: "Stock Reservation Board",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },
  {
    route: "/admin/inventory-risk-board",
    label: "Inventory Risk & Expiry Board",
    subsystem: "INVENTORY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },

  // ── 3PGS / THIRD-PARTY GOODS ─────────────────────────────────────────────
  {
    route: "/admin/3pgs-packing-material",
    label: "3PGS Packing Material Catalogue",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["STORE_3RD_PARTY"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. No PROCUREMENT_MANAGER role exists (see ROLE_NOT_IMPLEMENTED); STORE_3RD_PARTY is the closest real role.",
  },
  {
    route: "/admin/3pcs-store",
    label: "3PCS Internal Booking",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["STORE_3RD_PARTY"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 466; auth-routing.ts defaults STORE_3RD_PARTY here.",
  },
  {
    route: "/admin/3pgs-procurement-queue",
    label: "3PGS Procurement Queue (vendor-shortage bridge)",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["STORE_3RD_PARTY"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: ThreePgsProcurementQueue. Omitted entirely from the first version of this registry.",
  },

  // ── TRACE / DISPLAY ──────────────────────────────────────────────────────
  {
    route: "/admin/label-command-center",
    label: "Label Command Center",
    subsystem: "TRACE_DISPLAY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["PACKING_SUPERVISOR"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES. No PACKING_MANAGER role exists (see ROLE_NOT_IMPLEMENTED); PACKING_SUPERVISOR is the closest real role, though its STAFF_ROLE_DESTINATIONS default is /admin/order-management, not here.",
  },
  {
    route: "/admin/display-management",
    label: "Display Management & Controls",
    subsystem: "TRACE_DISPLAY",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: ["TV_DISPLAY"],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Gated only by shared /admin ADMIN_STAFF_ROLES.",
  },

  // ── LEGACY REDIRECTS (proven dead-data source, redirected in App.tsx) ────
  {
    route: "/admin/execution/production",
    label: "Legacy Production Execution Board (redirected)",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/operations-controller",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 422: <Navigate to=\"/operations-controller\" replace />. Read operational_queue_items, a table with zero writers -- confirmed dead data. Fixed in PR #404.",
  },
  {
    route: "/admin/execution/assembly",
    label: "Legacy Assembly Board (redirected)",
    subsystem: "ASSEMBLY_PACKING",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/assembly-tasks",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 423. Fixed in PR #404.",
  },
  {
    route: "/admin/execution/ready-goods",
    label: "Legacy Ready Goods Board (redirected)",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/ready-goods",
    deviceClass: "DESKTOP",
    evidence: "App.tsx line 424. Fixed in PR #404.",
  },

  // ── FACTORY_LEGACY (same dead-data table, NOT redirected -- no proven
  //    1:1 canonical replacement established yet; out of scope for this
  //    closure per the owner's explicit instruction that a redirect needs
  //    a proven target plus a passing test first) ────────────────────────
  {
    route: "/admin/execution/dispatch",
    label: "Legacy Dispatch Execution Board (redirected)",
    subsystem: "DISPATCH",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/dispatch-mgmt",
    deviceClass: "DESKTOP",
    evidence: "Lane D closure: DispatchExecutionBoard now redirects to FACT-C3 DispatchManagement (/admin/dispatch-mgmt). The former DepartmentExecutionBoard projection read operational_queue_items (zero writers). Governed consignment/carton/DPL authority lives only on dispatch-mgmt.",
  },
  {
    route: "/admin/execution/third-party",
    label: "Legacy Third-Party Execution Board (redirected)",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/3pgs-procurement-queue",
    deviceClass: "DESKTOP",
    evidence: "Point86: ThirdPartyExecutionBoard now redirects to governed 3PGS procurement queue. Former DepartmentExecutionBoard read operational_queue_items (zero writers).",
  },
  {
    route: "/admin/execution/retail",
    label: "Legacy Retail Execution Board (redirected)",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/reservation-board",
    deviceClass: "DESKTOP",
    evidence: "Point86: RetailExecutionBoard redirects to reservation-board. Auto retail queue creation from orders blocked pending Core producer RPC.",
  },
  {
    route: "/admin/execution/complaints",
    label: "Legacy Complaints Execution Board (redirected)",
    subsystem: "3PGS_THIRD_PARTY",
    technicallyAllowedRoles: [],
    intendedPrimaryAudience: [],
    status: "LEGACY_REDIRECT",
    legacyRedirectTarget: "/admin/support",
    deviceClass: "DESKTOP",
    evidence: "Point86: ComplaintsExecutionBoard redirects to AdminSupport (support_tickets authority). Auto customer_support queue creation from orders blocked pending Core producer RPC.",
  },

  // ── FACTORY_LEGACY: ExecutionCommandCenter family (Point86 retired dead queue read) ──
  {
    route: "/admin/execution-command-center",
    label: "Execution Command Center",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_CURRENT",
    deviceClass: "DESKTOP",
    evidence: "Point86: useExecutionCommandCenter now reads canonical Core department-queue routing contract (production_jobs, b2b_assembly_jobs, inventory_reservations, b2b_dispatch_consignments, b2b_procurement_requirements) instead of operational_queue_items.",
  },
  {
    route: "/admin/execution-risk",
    label: "Execution Risk Board (legacy)",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_LEGACY",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: ExecutionRiskBoard, same useExecutionCommandCenter hook / dead-data table.",
  },
  {
    route: "/admin/execution-bottlenecks",
    label: "Execution Bottlenecks (legacy)",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_LEGACY",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: ExecutionBottlenecks, same useExecutionCommandCenter hook / dead-data table.",
  },

  // ── FACTORY_PREVIEW ────────────────────────────────────────────────────
  {
    route: "/admin/queue-execution-preview",
    label: "Queue Execution Preview",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_PREVIEW",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: QueueExecutionPreview, name and useOperationalExecution hook indicate an unvalidated prototype, not a certified current surface. Not self-labeled dead-data (distinct from FACTORY_LEGACY) but not proven current either.",
  },
  {
    route: "/admin/barcode-execution-preview",
    label: "Barcode Execution Preview",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_PREVIEW",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: BarcodeExecutionPreview, useBarcodeExecution hook, 'preview' naming.",
  },

  // ── FACTORY_RELATED_BUT_OUT_OF_SCOPE ──────────────────────────────────
  {
    route: "/admin/live-work-queues",
    label: "Live Work Queues (Command Center)",
    subsystem: "PRODUCTION_EXECUTION",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: LiveWorkQueues. Reads production_jobs (hosts the PR #404 'Production Jobs (Governed)' KPI) but is a general cross-department Command Center board, not a floor/warehouse-role Factory Operations screen -- out of scope for per-role Factory certification.",
  },
  {
    route: "/admin/store-coordination",
    label: "Store Coordination",
    subsystem: "RGS_STORAGE",
    technicallyAllowedRoles: ADMIN_STAFF_ROLES_REFERENCE,
    intendedPrimaryAudience: [],
    status: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    deviceClass: "DESKTOP",
    evidence: "App.tsx: StoreCoordination. Uses readyGoodsVisibility (RGS-adjacent) but also retailLaunchFeed/storeFeed -- a broader multi-department store-coordination screen, not a narrow Factory Operations execution surface.",
  },
];

/** Routes actually in scope for Factory Operations certification. */
export const CERTIFIABLE_STATUSES: FactoryRouteStatus[] = ["FACTORY_CURRENT"];

/** Routes eligible for Factory Operations certification (excludes legacy/preview/out-of-scope entries). */
export const getFactoryRoutesCurrentOnly = () =>
  FACTORY_OPERATIONS_ROUTES.filter(r => CERTIFIABLE_STATUSES.includes(r.status));

/** Derived, not hard-coded -- see route-source-reconciliation.spec.ts for a test that these stay accurate. */
export const FACTORY_ROUTES_CURRENT_COUNT = getFactoryRoutesCurrentOnly().length;
export const FACTORY_ROUTES_TOTAL_COUNT = FACTORY_OPERATIONS_ROUTES.length;
export const FACTORY_ROUTES_LEGACY_REDIRECT_COUNT = FACTORY_OPERATIONS_ROUTES.filter(r => r.status === "LEGACY_REDIRECT").length;
export const FACTORY_ROUTES_LEGACY_COUNT = FACTORY_OPERATIONS_ROUTES.filter(r => r.status === "FACTORY_LEGACY").length;
export const FACTORY_ROUTES_PREVIEW_COUNT = FACTORY_OPERATIONS_ROUTES.filter(r => r.status === "FACTORY_PREVIEW").length;
export const FACTORY_ROUTES_OUT_OF_SCOPE_COUNT = FACTORY_OPERATIONS_ROUTES.filter(r => r.status === "FACTORY_RELATED_BUT_OUT_OF_SCOPE").length;

/** Certifiable current-scope routes for one Factory subsystem. */
export const getFactoryRoutesBySubsystem = (subsystem: FactorySubsystem) =>
  FACTORY_OPERATIONS_ROUTES.filter(r => r.subsystem === subsystem && CERTIFIABLE_STATUSES.includes(r.status));

/** Every role referenced anywhere in the registry (both fields). */
export const getAllReferencedRoles = (): string[] => {
  const roles = new Set<string>();
  FACTORY_OPERATIONS_ROUTES.forEach(route => {
    route.technicallyAllowedRoles.forEach(role => roles.add(role));
    route.intendedPrimaryAudience.forEach(role => roles.add(role));
  });
  return Array.from(roles).sort();
};

export const isValidFactoryRoute = (route: string): boolean =>
  FACTORY_OPERATIONS_ROUTES.some(r => r.route === route && CERTIFIABLE_STATUSES.includes(r.status));

export const getFactoryRoute = (route: string): FactoryRouteEntry | undefined =>
  FACTORY_OPERATIONS_ROUTES.find(r => r.route === route);

export const isRoleTechnicallyAllowedOnRoute = (role: string, route: string): boolean => {
  const entry = getFactoryRoute(route);
  return entry ? entry.technicallyAllowedRoles.includes(role) : false;
};
