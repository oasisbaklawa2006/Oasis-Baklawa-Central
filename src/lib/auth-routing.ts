import { supabase } from "@/integrations/supabase/client";

type RoleRecord = {
  company_id: string | null;
  role: string | null;
};

// ─── Role → Route map ─────────────────────────────────────────────────────────
// Every route here MUST exist in App.tsx. Verified against App.tsx 14 May 2026.
const STAFF_ROLE_DESTINATIONS: Record<string, string> = {
  // CMD / Admin
  SUPER_ADMIN:              "/admin/cmd-war-room",
  OWNER:                    "/admin/cmd-war-room",
  ADMIN:                    "/admin/cmd-war-room",

  // Finance
  FINANCE_HEAD:             "/admin/accounts-release",
  FINANCE_EXEC:             "/admin/accounts-release",
  FINANCE_AUDITOR:          "/admin/accounts-release",

  // Operations (top-level route — NOT under /admin)
  OPERATIONS_MANAGER:       "/operations-controller",

  // Production managers — handheld execution. /operations-controller (the
  // mobile-first, department-scoped phh/ handheld surface -- see
  // OperationsController.tsx's HOD_DEPARTMENT_MAP filtering) is the real
  // execution tool these roles need; /admin/production is an unrelated
  // desktop-tabbed admin console (Order/Assembly/ReadyGoods/Inventory/
  // Dispatch management) with no handheld components at all. These roles
  // were previously landed on /admin/production despite this comment
  // already describing the intent as "handheld execution" -- a routing
  // defect confirmed by a reachability audit, fixed here. All these roles
  // are already authorised for /operations-controller (ADMIN_STAFF_ROLES
  // in App.tsx); this only changes the default post-login destination, not
  // any permission.
  PRODUCTION_MANAGER:       "/operations-controller",
  HOD_ARABIC:               "/operations-controller",
  HOD_FUSION:               "/operations-controller",
  HOD_CHOCOLATE:            "/operations-controller",
  HOD_DRAGEES:              "/operations-controller",
  HOD_BAKERY:               "/operations-controller",
  HOD_NUTS:                 "/operations-controller",
  // Dates has no standalone HOD desk -- it shares Fusion Sweets' handheld
  // execution surface, per the owner's six-TV estate (Central issue #368).
  HOD_DATES:                "/operations-controller",
  // Assembly (P&A) keeps its own dedicated, actively-developed management
  // screen -- not the production-floor handheld surface above.
  HOD_ASSEMBLY:             "/admin/assembly-tasks",

  // Production floor TV screens
  PROD_ARABIC_SWEETS:       "/tv/arabic-sweets",
  PROD_FUSION:              "/tv/fusion",
  // Dates is folded into the Fusion Sweets TV, not a standalone screen.
  PROD_DATES:               "/tv/fusion",
  PROD_CHOCOLATE:           "/tv/chocolate",
  // Dragees is folded into the Chocolates & Confectionery TV, not a
  // standalone screen, per the owner's six-TV estate (Central issue #368).
  PROD_DRAGEES:             "/tv/chocolate",
  PROD_BAKERY:              "/tv/bakery",
  PROD_NUTS:                "/tv/nuts",

  // TV wall display accounts (read-only, no timeout)
  // /admin/assembly-tv and /admin/dispatch-tv are real, working live boards
  // (real Supabase queries, loading/error states) but both self-label as
  // "internal preview, not yet evidence-validated" -- do not default-land
  // any role there until that validation is done, so TV_DISPLAY/TV_ASSEMBLY
  // land on the CMD War Room hub instead. TV_READY is RGS's dedicated TV
  // account and lands on the chrome-free kiosk route (/tv/rgs), matching
  // the five production TVs' pattern rather than the full authenticated
  // /admin shell -- RGS's TV was evidence-validated as part of Central
  // issue #368's Lane 1 closure, unlike assembly/dispatch.
  TV_DISPLAY:               "/admin/cmd-war-room",
  TV_ASSEMBLY:              "/admin/cmd-war-room",
  TV_READY:                 "/tv/rgs",

  // Store / Warehouse
  STORE_INCHARGE:           "/admin/ready-goods",
  STORE_READY_GOODS:        "/admin/ready-goods",
  RGS_ADMIN:                "/admin/ready-goods",
  STORE_3RD_PARTY:          "/admin/3pcs-store",

  // Dispatch
  DISPATCH_HEAD:            "/admin/dispatch-mgmt",
  DISPATCH_MANAGER:         "/admin/dispatch-mgmt",
  DISPATCH_INCHARGE:        "/admin/dispatch-mgmt",

  // Packing / Assembly
  ASSEMBLY_MANAGER:         "/admin/assembly-tasks",
  PACKING_SUPERVISOR:       "/admin/order-management",

  // Sales
  SALES_EXECUTIVE:          "/sales/dashboard",

  // Support
  SUPPORT_EXECUTIVE:        "/admin/support",

  // Catalogue
  CATALOGUE_CONTRIBUTOR:    "/admin/products",

  // Security Gate (top-level route — NOT under /admin)
  SECURITY_CONTROL:         "/security-gate",
  GATE_SECURITY:            "/security-gate",
};

// ─── Role sets ────────────────────────────────────────────────────────────────
export const STAFF_ROLES = new Set(Object.keys(STAFF_ROLE_DESTINATIONS));

export const BUYER_ROLES = new Set([
  "B2B_BUYER",
  "SPECIAL_BUYER",
  "HORECA_BUYER",
  "WHOLESALE_BUYER",
  "BULK_BUYER",
  "BUYER",
  "CLIENT",
  "CUSTOMER_USER",
]);

const CLIENT_ROLES = BUYER_ROLES;

// ─── Role type checks ─────────────────────────────────────────────────────────
export function isStaffRole(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r ? STAFF_ROLES.has(r) : false;
}

export function isStorefrontRole(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r ? CLIENT_ROLES.has(r) : false;
}

// ─── Normalize: always UPPERCASE for comparison ───────────────────────────────
export function normalizeRole(role?: string | null): string | null {
  return role?.trim().toUpperCase() ?? null;
}

// ─── Route resolver ───────────────────────────────────────────────────────────
// NEVER falls back to /admin for unknown roles — security risk
export function getRoleDestination(role?: string | null): string {
  const r = normalizeRole(role);

  if (!r || r === "PENDING") return "/customer-app-redirect";

  const dest = STAFF_ROLE_DESTINATIONS[r];
  if (dest) return dest;

  if (CLIENT_ROLES.has(r)) return "/customer-app-redirect";

  // Unknown role — do NOT send to /admin
  return "/customer-app-redirect";
}

// ─── Path check ───────────────────────────────────────────────────────────────
function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPathWithinRoleDestination(
  pathname: string,
  role?: string | null
): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  const current = normalizePathname(pathname);
  const dest = normalizePathname(getRoleDestination(r));
  return (
    current === dest ||
    current.startsWith(`${dest}/`) ||
    dest.startsWith(`${current}/`)
  );
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
function normalizeRecord(
  data: Partial<RoleRecord> | null | undefined
): RoleRecord | null {
  if (!data) return null;
  return {
    company_id: data.company_id ?? null,
    role: data.role ?? null,
  };
}

async function readRoleRecord(
  table: "profiles" | "users",
  userId: string
): Promise<RoleRecord | null> {
  const { data, error } = await supabase
    .from(table)
    .select("company_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeRecord(data);
}

export async function getServerRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_user_role", {
    _user_id: userId,
  });
  if (error) return null;
  return normalizeRole(data);
}

export async function isInternalStaffUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_internal_staff", {
    _user_id: userId,
  });
  if (error) return false;
  return Boolean(data);
}

export async function fetchAuthRoleRecord(userId: string): Promise<RoleRecord> {
  if (!userId) return { role: null, company_id: null };

  try {
    const [serverRole, profileRecord, userRecord] = await Promise.all([
      getServerRole(userId).catch(() => null),
      readRoleRecord("profiles", userId).catch(() => null),
      readRoleRecord("users", userId).catch(() => null),
    ]);

    return {
      company_id: profileRecord?.company_id ?? userRecord?.company_id ?? null,
      role:
        serverRole ??
        normalizeRole(profileRecord?.role) ??
        normalizeRole(userRecord?.role) ??
        null,
    };
  } catch {
    const userRecord = await readRoleRecord("users", userId).catch(() => null);
    return {
      company_id: userRecord?.company_id ?? null,
      role: normalizeRole(userRecord?.role) ?? null,
    };
  }
}
