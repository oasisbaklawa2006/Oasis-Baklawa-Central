/**
 * Central Admin Module Authority Matrix — Point 57 durable census
 *
 * Authoritative registry of every mounted Central route/module, its surface
 * owner, RBAC module gate, guard layer, and programme ownership for deferred
 * work. Tests in centralAdminModuleAuthorityMatrix.test.ts reconcile this
 * matrix against App.tsx, AdminLayout nav, routeAccess.ts, and
 * AdminModuleRoute wrappers.
 *
 * DO NOT maintain parallel hand-written copies. Update this file when routes,
 * guards, or module ownership change.
 */

import type { AppVerseModuleKey } from "./roleAccess";

export type CentralRouteSurface =
  | "CENTRAL_ADMIN"
  | "FACTORY_TV"
  | "SECURITY_GATE"
  | "OPERATIONS_HANDHELD"
  | "SALES_CONSOLE"
  | "AUTH_GATE"
  | "BUYER_LEGACY";

export type CentralRouteDisposition =
  | "CANONICAL"
  | "COMPATIBILITY_ALIAS"
  | "LEGACY_REDIRECT"
  | "PREVIEW"
  | "SPECIALIST_UNNAV"
  | "DEMO";

export type CentralRouteGuard =
  | "ADMIN_ROUTE_GUARD"
  | "ROLE_PROTECTED"
  | "ADMIN_MODULE_ROUTE"
  | "WHATSAPP_PERMISSION"
  | "COMPOSITE";

export type ProgrammeOwnership =
  | "POINT57"
  | "POINT58"
  | "POINT59"
  | "POINT71"
  | "POINT18"
  | "DISPATCH_P0_456"
  | "FACTORY_OPS"
  | "WA"
  | "R4_3PGS"
  | "TRACE"
  | "BUYER_APP";

export type CentralModuleAuthorityEntry = {
  /** Normalized absolute path (e.g. "/admin/clients") */
  route: string;
  label: string;
  surface: CentralRouteSurface;
  /** Functional owner / authoritative App-Verse surface */
  owner: string;
  /** Module key enforced by AdminRouteGuard via routeAccess.ts */
  routeGuardModuleKey: AppVerseModuleKey | null;
  /** Optional narrower AdminModuleRoute wrapper module (when present in App.tsx) */
  adminModuleRouteKey?: AppVerseModuleKey | null;
  disposition: CentralRouteDisposition;
  guard: CentralRouteGuard;
  /** Read vs write authority summary for audit census */
  readAuthority: "SUPABASE" | "EDGE" | "LOCAL" | "NONE" | "MIXED";
  writeAuthority: "SUPABASE" | "RPC" | "EDGE" | "NONE" | "BLOCKED" | "MIXED";
  programmeOwnership: ProgrammeOwnership;
  notes?: string;
};

/**
 * Authority collisions intentionally deferred to another programme lane.
 * Point 57 documents these; it does not resolve them.
 */
export const CENTRAL_DEFERRED_AUTHORITY_COLLISIONS = [
  {
    route: "/admin/dispatch-mgmt",
    collision:
      "AdminRouteGuard maps to packing; AdminModuleRoute wrapper requires dispatch; Command nav uses dispatch, Operations nav uses packing.",
    deferredTo: "DISPATCH_P0_456",
  },
  {
    route: "/admin/ready-goods-day-close",
    collision: "Nav filters on inventory_audit; routeAccess maps to inventory (broader direct-route reach).",
    deferredTo: "POINT57_NAV_ROUTE_DIVERGENCE",
  },
  {
    route: "/admin/ready-goods-reports",
    collision: "Nav filters on inventory_audit; routeAccess maps to inventory (broader direct-route reach).",
    deferredTo: "POINT57_NAV_ROUTE_DIVERGENCE",
  },
  {
    route: "/admin/order-management",
    collision:
      "Nav exposes production/packing view moduleKeys on query variants; routeAccess maps all paths to orders.",
    deferredTo: "POINT57_NAV_VIEW_GATING",
  },
] as const;

/** Nav moduleKey overrides that are intentional (not matrix contradictions). */
export const CENTRAL_NAV_MODULE_OVERRIDES: Record<string, AppVerseModuleKey> = {
  "/admin/order-management?view=production": "production",
  "/admin/order-management?view=packing": "packing",
  "/admin/ready-goods-day-close": "inventory_audit",
  "/admin/ready-goods-reports": "inventory_audit",
};

/**
 * Authoritative Central module authority matrix.
 * Last reconciled against main @ 64a107df (2026-09-06).
 */
export const CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX: CentralModuleAuthorityEntry[] = [
  // ── Auth / gates ───────────────────────────────────────────────────────
  { route: "/", label: "Root gate", surface: "AUTH_GATE", owner: "Central / Auth", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/splash", label: "Splash", surface: "AUTH_GATE", owner: "Central / Auth", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/login", label: "Login", surface: "AUTH_GATE", owner: "Central / Auth", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/reset-password", label: "Reset password", surface: "AUTH_GATE", owner: "Central / Auth", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/customer-app-redirect", label: "Customer app redirect", surface: "AUTH_GATE", owner: "Central / Auth", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "BUYER_APP" },
  { route: "/buyer/access-request", label: "Buyer access request", surface: "BUYER_LEGACY", owner: "Buyer App (legacy Central route)", routeGuardModuleKey: null, disposition: "COMPATIBILITY_ALIAS", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "BUYER_APP", notes: "Customer storefront belongs in Expo oasis-baklawa." },
  { route: "/buyer/*", label: "Buyer app shell", surface: "BUYER_LEGACY", owner: "Buyer App (legacy Central route)", routeGuardModuleKey: null, disposition: "COMPATIBILITY_ALIAS", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "BUYER_APP" },

  // ── Non-admin operational surfaces ─────────────────────────────────────
  { route: "/operations-controller", label: "Production operations controller", surface: "OPERATIONS_HANDHELD", owner: "Central / Production", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "FACTORY_OPS" },
  { route: "/security-gate", label: "Security gate checkpoint", surface: "SECURITY_GATE", owner: "Central / Dispatch Gate", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/sales/dashboard", label: "Sales console", surface: "SALES_CONSOLE", owner: "Central / CRM Lite", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "POINT59" },
  { route: "/sales/3pgs-visibility", label: "Sales 3PGS satellite", surface: "SALES_CONSOLE", owner: "Central / R4 3PGS", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "R4_3PGS" },

  // ── TV kiosk network ───────────────────────────────────────────────────
  { route: "/tv/arabic-sweets", label: "Arabic sweets production TV", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/chocolate", label: "Chocolate production TV", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/dragees", label: "Dragees TV (redirect)", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "LEGACY_REDIRECT", guard: "ROLE_PROTECTED", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Redirects to /tv/chocolate." },
  { route: "/tv/fusion", label: "Fusion sweets production TV", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/bakery", label: "Bakery production TV", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/nuts", label: "Nuts production TV", surface: "FACTORY_TV", owner: "Central / Production TV", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/rgs", label: "Ready goods store TV", surface: "FACTORY_TV", owner: "Central / RGS", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/tv/3pgs", label: "3PGS TV kiosk", surface: "FACTORY_TV", owner: "Central / R4 3PGS", routeGuardModuleKey: null, disposition: "CANONICAL", guard: "ROLE_PROTECTED", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "R4_3PGS" },

  // ── Admin home / command ───────────────────────────────────────────────
  { route: "/admin", label: "App-Verse home", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "dashboard", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/heartbeat", label: "Executive dashboard (alias)", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "cmd_war_room", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT57", notes: "Alias of AdminDashboard." },
  { route: "/admin/execution-command-center", label: "Execution command center", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58", notes: "Reads operational_queue_items (dead data)." },
  { route: "/admin/execution-risk", label: "Execution risk board", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/execution-bottlenecks", label: "Execution bottlenecks", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/live-work-queues", label: "Live work queues", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "POINT71" },
  { route: "/admin/entity-graph-explorer", label: "Entity graph explorer", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "SPECIALIST_UNNAV", guard: "COMPOSITE", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/queue-execution-preview", label: "Queue execution preview", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/barcode-execution-preview", label: "Barcode execution preview", surface: "CENTRAL_ADMIN", owner: "Central / CMD War Room", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/product-intelligence-prototype", label: "Product intelligence lab", surface: "CENTRAL_ADMIN", owner: "AI Studio (link-out)", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "DEMO", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58", notes: "LINK-OUT to AI Studio authority." },
  { route: "/admin/customer-timeline-preview", label: "Customer timeline preview", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT59" },
  { route: "/admin/operational-search", label: "Operational search", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "cmd_war_room", adminModuleRouteKey: "cmd_war_room", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/target-vs-actual", label: "Target vs actual", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "cmd_war_room", disposition: "SPECIALIST_UNNAV", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "POINT57" },

  // ── Execution board redirects ──────────────────────────────────────────
  { route: "/admin/execution/production", label: "Production board (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Production", routeGuardModuleKey: "production", disposition: "LEGACY_REDIRECT", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Redirects to /operations-controller." },
  { route: "/admin/execution/assembly", label: "Assembly board (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Production", routeGuardModuleKey: "production", disposition: "LEGACY_REDIRECT", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Redirects to /admin/assembly-tasks." },
  { route: "/admin/execution/ready-goods", label: "Ready goods board (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / RGS", routeGuardModuleKey: "inventory", disposition: "LEGACY_REDIRECT", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Redirects to /admin/ready-goods." },
  { route: "/admin/execution/dispatch", label: "Dispatch board (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "dispatch", disposition: "LEGACY_REDIRECT", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "DISPATCH_P0_456", notes: "Redirects to /admin/dispatch-mgmt." },
  { route: "/admin/execution/third-party", label: "Third party execution board", surface: "CENTRAL_ADMIN", owner: "Central / 3PGS", routeGuardModuleKey: "orders", adminModuleRouteKey: "orders", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "R4_3PGS" },
  { route: "/admin/execution/retail", label: "Retail execution board", surface: "CENTRAL_ADMIN", owner: "Central / Retail", routeGuardModuleKey: "inventory", adminModuleRouteKey: "inventory", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/execution/complaints", label: "Complaints execution board", surface: "CENTRAL_ADMIN", owner: "Central / Support", routeGuardModuleKey: "support", adminModuleRouteKey: "support", disposition: "PREVIEW", guard: "COMPOSITE", readAuthority: "LOCAL", writeAuthority: "NONE", programmeOwnership: "POINT58" },

  // ── Customers / WhatsApp / Support ─────────────────────────────────────
  { route: "/admin/clients", label: "Clients", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "clients", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT59" },
  { route: "/admin/customers", label: "Customers (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "clients", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT59", notes: "Redirects to /admin/clients." },
  { route: "/admin/crm", label: "CRM (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "clients", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT59" },
  { route: "/admin/approvals", label: "Approvals (clients mode)", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "clients", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT59" },
  { route: "/admin/operator-inbox", label: "WhatsApp operator inbox", surface: "CENTRAL_ADMIN", owner: "Central / WhatsApp", routeGuardModuleKey: "support", disposition: "CANONICAL", guard: "WHATSAPP_PERMISSION", readAuthority: "SUPABASE", writeAuthority: "EDGE", programmeOwnership: "WA" },
  { route: "/admin/whatsapp", label: "WhatsApp (alias)", surface: "CENTRAL_ADMIN", owner: "Central / WhatsApp", routeGuardModuleKey: "support", disposition: "COMPATIBILITY_ALIAS", guard: "WHATSAPP_PERMISSION", readAuthority: "SUPABASE", writeAuthority: "EDGE", programmeOwnership: "WA" },
  { route: "/admin/support", label: "Support", surface: "CENTRAL_ADMIN", owner: "Central / Support", routeGuardModuleKey: "support", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/exceptions", label: "Exceptions", surface: "CENTRAL_ADMIN", owner: "Central / Support", routeGuardModuleKey: "exceptions", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "POINT57" },
  { route: "/admin/central-pool", label: "Central pool (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Orders", routeGuardModuleKey: "support", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT71", notes: "Redirects to /admin/operator-inbox." },
  { route: "/admin/cmd-war-room", label: "CMD war room (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "cmd_war_room", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT71", notes: "Redirects to /admin/operator-inbox." },

  // ── Orders / Finance ───────────────────────────────────────────────────
  { route: "/admin/order-management", label: "Order pipeline", surface: "CENTRAL_ADMIN", owner: "Central / Orders", routeGuardModuleKey: "orders", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "POINT71" },
  { route: "/admin/orders", label: "Orders (legacy list)", surface: "CENTRAL_ADMIN", owner: "Central / Orders", routeGuardModuleKey: "orders", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT71" },
  { route: "/admin/accounts-release", label: "Accounts & release", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "accounts", adminModuleRouteKey: "accounts", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "POINT57" },
  { route: "/admin/finance", label: "Finance", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "finance", adminModuleRouteKey: "finance", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/finance-board", label: "Finance release board", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "finance", adminModuleRouteKey: "finance", disposition: "SPECIALIST_UNNAV", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/finance-governance", label: "Finance governance", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "finance_audit", adminModuleRouteKey: "finance_audit", disposition: "SPECIALIST_UNNAV", guard: "COMPOSITE", readAuthority: "MIXED", writeAuthority: "RPC", programmeOwnership: "POINT57" },
  { route: "/admin/finance/payments", label: "Finance payments (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "finance", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/finance/invoices", label: "Finance invoices (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Finance", routeGuardModuleKey: "finance", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/pricing", label: "Pricing matrix", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "pricing", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/moq", label: "MOQ rules", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "moq", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/currency", label: "Currency", surface: "CENTRAL_ADMIN", owner: "Central / Settings", routeGuardModuleKey: "currency", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/sales-hub", label: "Sales performance hub", surface: "CENTRAL_ADMIN", owner: "Central / CRM", routeGuardModuleKey: "cmd_war_room", disposition: "SPECIALIST_UNNAV", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "POINT59" },

  // ── Operations / Production / Stores ───────────────────────────────────
  { route: "/admin/production", label: "Production (legacy)", surface: "CENTRAL_ADMIN", owner: "Central / Production", routeGuardModuleKey: "production", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/operations", label: "Operations (legacy)", surface: "CENTRAL_ADMIN", owner: "Central / Production", routeGuardModuleKey: "production", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/assembly-tasks", label: "Assembly management", surface: "CENTRAL_ADMIN", owner: "Central / Assembly", routeGuardModuleKey: "production", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/assembly", label: "Assembly (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Assembly", routeGuardModuleKey: "production", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/assembly-tv", label: "Assembly TV", surface: "CENTRAL_ADMIN", owner: "Central / Assembly", routeGuardModuleKey: "production", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/inventory-command-center", label: "Inventory command center", surface: "CENTRAL_ADMIN", owner: "Central / Inventory", routeGuardModuleKey: "inventory", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/inventory-receiving", label: "Inventory receiving", surface: "CENTRAL_ADMIN", owner: "Central / Inventory", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "R4_3PGS" },
  { route: "/admin/carton-explorer", label: "Carton explorer", surface: "CENTRAL_ADMIN", owner: "Central / Trace context", routeGuardModuleKey: "inventory", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "TRACE", notes: "Trace authority must not be duplicated." },
  { route: "/admin/reservation-board", label: "Reservation board", surface: "CENTRAL_ADMIN", owner: "Central / Inventory audit", routeGuardModuleKey: "inventory_audit", disposition: "SPECIALIST_UNNAV", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "POINT57" },
  { route: "/admin/inventory-risk-board", label: "Inventory risk board", surface: "CENTRAL_ADMIN", owner: "Central / Inventory", routeGuardModuleKey: "inventory", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "POINT58" },
  { route: "/admin/scan-timeline", label: "Scan timeline", surface: "CENTRAL_ADMIN", owner: "Central / Trace context", routeGuardModuleKey: "inventory", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "NONE", programmeOwnership: "TRACE" },
  { route: "/admin/ready-goods", label: "Ready goods store", surface: "CENTRAL_ADMIN", owner: "Central / RGS", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/ready-goods-stock", label: "RGS stock position", surface: "CENTRAL_ADMIN", owner: "Central / RGS", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/ready-goods-day-close", label: "RGS day close", surface: "CENTRAL_ADMIN", owner: "Central / RGS audit", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "FACTORY_OPS", notes: "Nav uses inventory_audit filter; route guard uses inventory." },
  { route: "/admin/ready-goods-reports", label: "RGS reports", surface: "CENTRAL_ADMIN", owner: "Central / RGS audit", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Nav uses inventory_audit filter; route guard uses inventory." },
  { route: "/admin/production-demand-planner", label: "Production demand planner", surface: "CENTRAL_ADMIN", owner: "Central / RGS", routeGuardModuleKey: "production", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/rgs-tv", label: "RGS TV (admin path)", surface: "CENTRAL_ADMIN", owner: "Central / RGS", routeGuardModuleKey: "inventory", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "FACTORY_OPS", notes: "Canonical kiosk is /tv/rgs." },
  { route: "/admin/3pgs-packing-material", label: "3PGS packing material", surface: "CENTRAL_ADMIN", owner: "Central / R4 3PGS", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "R4_3PGS" },
  { route: "/admin/3pgs-procurement-queue", label: "3PGS procurement queue", surface: "CENTRAL_ADMIN", owner: "Central / R4 3PGS", routeGuardModuleKey: "inventory", adminModuleRouteKey: "inventory", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "R4_3PGS" },
  { route: "/admin/3pgs-visibility", label: "3PGS satellite visibility", surface: "CENTRAL_ADMIN", owner: "Central / R4 3PGS", routeGuardModuleKey: "inventory", adminModuleRouteKey: "inventory", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "R4_3PGS" },
  { route: "/admin/3pgs-mobile-urgent", label: "3PGS mobile urgent", surface: "CENTRAL_ADMIN", owner: "Central / R4 3PGS", routeGuardModuleKey: "inventory", adminModuleRouteKey: "inventory", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "R4_3PGS" },
  { route: "/admin/3pgs-tv", label: "3PGS TV (admin path)", surface: "CENTRAL_ADMIN", owner: "Central / R4 3PGS", routeGuardModuleKey: "inventory", adminModuleRouteKey: "inventory", disposition: "COMPATIBILITY_ALIAS", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "R4_3PGS", notes: "Canonical kiosk is /tv/3pgs." },
  { route: "/admin/3pcs-store", label: "3PCS internal booking", surface: "CENTRAL_ADMIN", owner: "Central / 3PGS", routeGuardModuleKey: "inventory", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "R4_3PGS" },
  { route: "/admin/store-coordination", label: "Store coordination", surface: "CENTRAL_ADMIN", owner: "Central / Stores", routeGuardModuleKey: "orders", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "MIXED", programmeOwnership: "POINT57" },
  { route: "/admin/label-command-center", label: "Label command center", surface: "CENTRAL_ADMIN", owner: "Central / Trace context", routeGuardModuleKey: "orders", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "MIXED", programmeOwnership: "TRACE" },
  { route: "/admin/inventory", label: "Factory stock", surface: "CENTRAL_ADMIN", owner: "Central / Inventory", routeGuardModuleKey: "inventory", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "POINT57" },
  { route: "/admin/stock-finalization", label: "Stock finalization", surface: "CENTRAL_ADMIN", owner: "Central / Inventory audit", routeGuardModuleKey: "inventory_audit", disposition: "SPECIALIST_UNNAV", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "BLOCKED", programmeOwnership: "POINT58", notes: "BLOCKED-BY-BACKEND per disposition matrix." },

  // ── Dispatch / Packing ─────────────────────────────────────────────────
  { route: "/admin/packing-dispatch", label: "Packing & dispatch (legacy)", surface: "CENTRAL_ADMIN", owner: "Central / Orders", routeGuardModuleKey: "orders", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/admin/dispatch", label: "Dispatch (alias)", surface: "CENTRAL_ADMIN", owner: "Central / Orders", routeGuardModuleKey: "orders", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "DISPATCH_P0_456", notes: "Alias of packing-dispatch." },
  { route: "/admin/dispatch-mgmt", label: "Dispatch management", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "packing", adminModuleRouteKey: "dispatch", disposition: "CANONICAL", guard: "COMPOSITE", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456", notes: "Authority collision deferred to #456." },
  { route: "/admin/dispatch-readiness", label: "Dispatch readiness", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "dispatch", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/admin/dispatch-completion", label: "Dispatch completion", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "dispatch", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/admin/dispatch-finalization", label: "Dispatch finalization", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "dispatch", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/admin/dispatch-tv", label: "Dispatch TV", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch", routeGuardModuleKey: "orders", disposition: "PREVIEW", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "DISPATCH_P0_456" },
  { route: "/admin/golden-chain-operator", label: "Golden chain operator", surface: "CENTRAL_ADMIN", owner: "Central / Dispatch orchestration", routeGuardModuleKey: "dispatch", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "MIXED", writeAuthority: "RPC", programmeOwnership: "DISPATCH_P0_456", notes: "Union access: dispatch + finance + inventory modules." },

  // ── Products / Catalogue ───────────────────────────────────────────────
  { route: "/admin/products", label: "Products", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "products", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/merchandising", label: "Merchandising", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "products", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/catalogue-sync", label: "Catalogue sync", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "products", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "POINT57" },
  { route: "/admin/catalogue-approvals", label: "Catalogue approvals", surface: "CENTRAL_ADMIN", owner: "Central / Products", routeGuardModuleKey: "products", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "RPC", programmeOwnership: "POINT57" },

  // ── Governance / Administration ────────────────────────────────────────
  { route: "/admin/users", label: "Users", surface: "CENTRAL_ADMIN", owner: "Central / RBAC", routeGuardModuleKey: "users", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT18" },
  { route: "/admin/roles", label: "Roles (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / RBAC", routeGuardModuleKey: "users", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT18" },
  { route: "/admin/settings", label: "Settings", surface: "CENTRAL_ADMIN", owner: "Central / Settings", routeGuardModuleKey: "settings", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/audit", label: "Audit trail", surface: "CENTRAL_ADMIN", owner: "Central / Governance", routeGuardModuleKey: "audit", disposition: "SPECIALIST_UNNAV", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "POINT18" },
  { route: "/admin/department", label: "Department (legacy)", surface: "CENTRAL_ADMIN", owner: "Central / Governance", routeGuardModuleKey: "audit", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "NONE", programmeOwnership: "POINT57" },
  { route: "/admin/logistics", label: "Logistics", surface: "CENTRAL_ADMIN", owner: "Central / Settings", routeGuardModuleKey: "settings", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "POINT57" },
  { route: "/admin/notifications", label: "Notifications", surface: "CENTRAL_ADMIN", owner: "Central / Settings", routeGuardModuleKey: "settings", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/announcements", label: "Announcements", surface: "CENTRAL_ADMIN", owner: "Central / Settings", routeGuardModuleKey: "settings", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "SUPABASE", programmeOwnership: "POINT57" },
  { route: "/admin/display-management", label: "Display management", surface: "CENTRAL_ADMIN", owner: "Central / TV admin", routeGuardModuleKey: "settings", disposition: "CANONICAL", guard: "ADMIN_ROUTE_GUARD", readAuthority: "SUPABASE", writeAuthority: "MIXED", programmeOwnership: "FACTORY_OPS" },
  { route: "/admin/verification", label: "Verification (redirect)", surface: "CENTRAL_ADMIN", owner: "Central / Command", routeGuardModuleKey: "cmd_war_room", disposition: "COMPATIBILITY_ALIAS", guard: "ADMIN_ROUTE_GUARD", readAuthority: "NONE", writeAuthority: "NONE", programmeOwnership: "POINT58", notes: "Redirects to execution-command-center." },
];

export const CENTRAL_MATRIX_ROUTE_COUNT = CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.length;

export function getCentralMatrixEntry(route: string): CentralModuleAuthorityEntry | undefined {
  return CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.find((entry) => entry.route === route);
}

export function getCentralMatrixRoutesBySurface(surface: CentralRouteSurface): CentralModuleAuthorityEntry[] {
  return CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.filter((entry) => entry.surface === surface);
}

export function getCentralMatrixRoutesByOwnership(
  ownership: ProgrammeOwnership,
): CentralModuleAuthorityEntry[] {
  return CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.filter(
    (entry) => entry.programmeOwnership === ownership,
  );
}
