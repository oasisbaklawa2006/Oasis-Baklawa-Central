import { supabase } from "@/integrations/supabase/client";

type RoleRecord = {
  company_id: string | null;
  role: string | null;
};

const CLIENT_ROLES = new Set(["BUYER", "CLIENT", "CUSTOMER_USER"]);

const ORDER_MANAGEMENT_ROLES = new Set([
  "PRODUCTION_MANAGER",
  "PACKING_SUPERVISOR",
  "ASSEMBLY_MANAGER",
  "DISPATCH_HEAD",
]);

const OPERATIONS_CONTROLLER_ROLES = new Set([
  "STORE_READY_GOODS",
  "STORE_3RD_PARTY",
]);

const FACTORY_TV_ROUTES: Record<string, string> = {
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

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
  if (normalizedRole === "SUPER_ADMIN") return "/admin/cmd-war-room";
  if (normalizedRole === "ADMIN") return "/admin";
  if (normalizedRole === "FINANCE_HEAD") return "/admin/accounts-release";
  if (normalizedRole === "SUPPORT_EXECUTIVE") return "/admin/support";
  if (normalizedRole === "SALES_EXECUTIVE") return "/sales/dashboard";
  if (normalizedRole === "GATE_SECURITY") return "/security-gate";
  if (ORDER_MANAGEMENT_ROLES.has(normalizedRole)) return "/admin/order-management";
  if (OPERATIONS_CONTROLLER_ROLES.has(normalizedRole)) return "/operations-controller";
  if (FACTORY_TV_ROUTES[normalizedRole]) return FACTORY_TV_ROUTES[normalizedRole];
  if (CLIENT_ROLES.has(normalizedRole)) return "/home";

  return "/admin";
}