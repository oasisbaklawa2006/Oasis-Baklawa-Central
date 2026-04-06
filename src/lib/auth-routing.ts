import { supabase } from "@/integrations/supabase/client";

type RoleRecord = {
  company_id: string | null;
  role: string | null;
};

// ─── Canonical Role Taxonomy ───
export const STAFF_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE_HEAD",
  "FINANCE_EXEC",
  "OPERATIONS_MANAGER",
  "PRODUCTION_MANAGER",
  "HOD_ARABIC",
  "HOD_FUSION",
  "HOD_CHOCOLATE",
  "HOD_BAKERY",
  "HOD_NUTS",
  "HOD_ASSEMBLY",
  "STORE_INCHARGE",
  "DISPATCH_MANAGER",
  "DISPATCH_INCHARGE",
  "SECURITY_CONTROL",
  "SALES_EXECUTIVE",
  "SUPPORT_EXECUTIVE",
]);

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

export function isStorefrontRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? CLIENT_ROLES.has(normalizedRole) : false;
}

export function getRoleDestination(role?: string | null) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole || normalizedRole === "PENDING") return "/approval-pending";

  // Admin / Command
  if (normalizedRole === "SUPER_ADMIN") return "/admin/cmd-war-room";
  if (normalizedRole === "ADMIN") return "/admin";

  // Finance
  if (normalizedRole === "FINANCE_HEAD" || normalizedRole === "FINANCE_EXEC") return "/admin/accounts-release";

  // Support
  if (normalizedRole === "SUPPORT_EXECUTIVE") return "/admin/support";

  // Sales
  if (normalizedRole === "SALES_EXECUTIVE") return "/sales/dashboard";

  // Security
  if (normalizedRole === "SECURITY_CONTROL" || normalizedRole === "GATE_SECURITY") return "/security-gate";

  // Stores
  if (normalizedRole === "STORE_INCHARGE" || normalizedRole === "STORE_READY_GOODS" || normalizedRole === "RGS_ADMIN") return "/admin/ready-goods";

  // Operations / Production / Dispatch
  if (normalizedRole === "OPERATIONS_MANAGER" || normalizedRole === "STORE_3RD_PARTY") return "/operations-controller";
  if (normalizedRole === "PRODUCTION_MANAGER" || normalizedRole === "PACKING_SUPERVISOR" || normalizedRole === "ASSEMBLY_MANAGER") return "/admin/order-management";
  if (normalizedRole === "DISPATCH_MANAGER" || normalizedRole === "DISPATCH_INCHARGE" || normalizedRole === "DISPATCH_HEAD") return "/admin/dispatch-mgmt";

  // HOD → Factory TV
  if (normalizedRole === "HOD_ARABIC") return "/tv/arabic-sweets";
  if (normalizedRole === "HOD_CHOCOLATE") return "/tv/chocolate";
  if (normalizedRole === "HOD_FUSION") return "/tv/fusion";
  if (normalizedRole === "HOD_BAKERY") return "/tv/bakery";
  if (normalizedRole === "HOD_NUTS") return "/tv/nuts";
  if (normalizedRole === "HOD_ASSEMBLY") return "/admin/assembly-tasks";

  // Legacy PROD_* TV roles (backward compat)
  if (normalizedRole === "PROD_ARABIC_SWEETS") return "/tv/arabic-sweets";
  if (normalizedRole === "PROD_CHOCOLATE") return "/tv/chocolate";
  if (normalizedRole === "PROD_FUSION") return "/tv/fusion";
  if (normalizedRole === "PROD_BAKERY") return "/tv/bakery";
  if (normalizedRole === "PROD_NUTS") return "/tv/nuts";

  // Buyer roles → storefront
  if (CLIENT_ROLES.has(normalizedRole)) return "/home";

  return "/admin";
}