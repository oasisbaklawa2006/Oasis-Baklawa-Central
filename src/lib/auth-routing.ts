import { supabase } from "@/integrations/supabase/client";

type RoleRecord = {
  company_id: string | null;
  role: string | null;
};

const STAFF_ROLE_DESTINATIONS = {
  SUPER_ADMIN: "/admin/cmd-war-room",
  ADMIN: "/admin",
  FINANCE_HEAD: "/admin/accounts-release",
  FINANCE_EXEC: "/admin/accounts-release",
  OPERATIONS_MANAGER: "/operations-controller",
  PRODUCTION_MANAGER: "/admin/order-management",
  HOD_ARABIC: "/tv/arabic-sweets",
  HOD_FUSION: "/tv/fusion",
  HOD_CHOCOLATE: "/tv/chocolate",
  HOD_DRAGEES: "/tv/dragees",
  HOD_BAKERY: "/tv/bakery",
  HOD_NUTS: "/tv/nuts",
  HOD_ASSEMBLY: "/admin/assembly-tasks",
  STORE_INCHARGE: "/admin/ready-goods",
  DISPATCH_MANAGER: "/admin/dispatch-mgmt",
  DISPATCH_INCHARGE: "/admin/dispatch-mgmt",
  SECURITY_CONTROL: "/security-gate",
  SALES_EXECUTIVE: "/sales/dashboard",
  SUPPORT_EXECUTIVE: "/admin/support",
} as const;

const LEGACY_ROLE_DESTINATIONS: Record<string, string> = {
  GATE_SECURITY: "/security-gate",
  STORE_READY_GOODS: "/admin/ready-goods",
  RGS_ADMIN: "/admin/ready-goods",
  STORE_3RD_PARTY: "/operations-controller",
  ASSEMBLY_MANAGER: "/admin/order-management",
  PACKING_SUPERVISOR: "/admin/order-management",
  DISPATCH_HEAD: "/admin/dispatch-mgmt",
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_DRAGEES: "/tv/dragees",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

// ─── Canonical Role Taxonomy ───
export const STAFF_ROLES = new Set(Object.keys(STAFF_ROLE_DESTINATIONS));

export const BUYER_ROLES = new Set([
  "B2B_BUYER",
  "SPECIAL_BUYER",
  "HORECA_BUYER",
  "WHOLESALE_BUYER",
  "BULK_BUYER",
]);

// Legacy buyer role names still in the DB — treat them like buyers
const LEGACY_BUYER_ROLES = new Set(["BUYER", "CLIENT", "CUSTOMER_USER"]);

const CLIENT_ROLES = new Set([...BUYER_ROLES, ...LEGACY_BUYER_ROLES]);

const ROLE_DESTINATIONS: Record<string, string> = {
  ...STAFF_ROLE_DESTINATIONS,
  ...LEGACY_ROLE_DESTINATIONS,
};

export function isStaffRole(role?: string | null): boolean {
  const n = normalizeRole(role);
  return n ? STAFF_ROLES.has(n) : false;
}

function normalizeRecord(data: Partial<RoleRecord> | null | undefined): RoleRecord | null {
  if (!data) return null;

  return {
    company_id: data.company_id ?? null,
    role: data.role ?? null,
  };
}

async function readRoleRecord(table: "profiles" | "users", userId: string): Promise<RoleRecord | null> {
  const { data, error } = await supabase
    .from(table)
    .select("company_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeRecord(data);
}

export async function fetchAuthRoleRecord(userId: string): Promise<RoleRecord> {
  try {
    const profileRecord = await readRoleRecord("profiles", userId);
    const userRecord = await readRoleRecord("users", userId);

    return {
      company_id: profileRecord?.company_id ?? userRecord?.company_id ?? null,
      role: profileRecord?.role ?? userRecord?.role ?? null,
    };
  } catch {
    const userRecord = await readRoleRecord("users", userId).catch(() => null);

    return {
      company_id: userRecord?.company_id ?? null,
      role: userRecord?.role ?? null,
    };
  }
}

export function normalizeRole(role?: string | null) {
  return role?.trim().toUpperCase() ?? null;
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isStorefrontRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? CLIENT_ROLES.has(normalizedRole) : false;
}

export function getRoleDestination(role?: string | null) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole || normalizedRole === "PENDING") return "/approval-pending";

  const directDestination = ROLE_DESTINATIONS[normalizedRole];
  if (directDestination) return directDestination;

  if (STAFF_ROLES.has(normalizedRole)) return "/admin";

  // Buyer roles → storefront
  if (CLIENT_ROLES.has(normalizedRole)) return "/home";

  return "/admin";
}

export function isPathWithinRoleDestination(pathname: string, role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  const currentPath = normalizePathname(pathname);
  const roleDestination = normalizePathname(getRoleDestination(normalizedRole));

  return (
    currentPath === roleDestination ||
    currentPath.startsWith(`${roleDestination}/`) ||
    roleDestination.startsWith(`${currentPath}/`)
  );
}