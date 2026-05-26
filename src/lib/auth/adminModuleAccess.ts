/** Shared admin module keys — keep in sync with AdminLayout nav `moduleKey` values. */
export const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "dashboard",
    "cmd_war_room",
    "orders",
    "clients",
    "products",
    "pricing",
    "finance",
    "users",
    "moq",
    "currency",
    "support",
    "settings",
    "audit",
    "inventory",
    "packing",
    "production",
    "accounts",
    "exceptions",
  ],
  FINANCE_HEAD: ["dashboard", "cmd_war_room", "finance", "accounts", "orders", "audit"],
  FINANCE_EXEC: ["dashboard", "cmd_war_room", "finance", "accounts", "orders"],
  OPERATIONS_MANAGER: ["dashboard", "cmd_war_room", "orders", "production", "packing", "dispatch", "inventory"],
  PRODUCTION_MANAGER: ["dashboard", "orders", "production"],
  HOD_ARABIC: ["dashboard", "production", "orders"],
  HOD_FUSION: ["dashboard", "production", "orders"],
  HOD_CHOCOLATE: ["dashboard", "production", "orders"],
  HOD_BAKERY: ["dashboard", "production", "orders"],
  HOD_NUTS: ["dashboard", "production", "orders"],
  HOD_ASSEMBLY: ["dashboard", "production", "orders"],
  HOD_DRAGEES: ["dashboard", "production", "orders"],
  STORE_INCHARGE: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  DISPATCH_MANAGER: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders", "inventory"],
  DISPATCH_INCHARGE: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders"],
  SECURITY_CONTROL: ["dashboard", "packing"],
  SALES_EXECUTIVE: [],
  SUPPORT_EXECUTIVE: ["dashboard", "support", "exceptions", "orders"],
  DISPATCH_HEAD: ["dashboard", "cmd_war_room", "packing", "dispatch", "orders", "inventory"],
  ASSEMBLY_MANAGER: ["dashboard", "production", "orders"],
  PACKING_SUPERVISOR: ["dashboard", "packing", "dispatch"],
  STORE_READY_GOODS: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  RGS_ADMIN: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  CUSTOMER_USER: [],
};

export function hasAdminModuleAccess(role: string | null | undefined, moduleKey: string): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  const allowed = ROLE_MODULE_ACCESS[normalized] ?? [];
  return allowed.includes("*") || allowed.includes(moduleKey);
}
