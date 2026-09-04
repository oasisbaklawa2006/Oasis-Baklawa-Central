export type AppVerseModuleKey =
  | "dashboard"
  | "cmd_war_room"
  | "orders"
  | "clients"
  | "products"
  | "pricing"
  | "finance"
  | "finance_audit"
  | "users"
  | "moq"
  | "currency"
  | "support"
  | "settings"
  | "audit"
  | "inventory"
  | "inventory_audit"
  | "packing"
  | "production"
  | "accounts"
  | "exceptions"
  | "dispatch"
  | "dispatch_audit";

export type AppVerseGrantedModule = AppVerseModuleKey | "*";

export const ROLE_MODULE_ACCESS: Record<string, AppVerseGrantedModule[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: [
    "dashboard", "cmd_war_room", "orders", "clients", "products", "pricing", "finance", "finance_audit",
    "users", "moq", "currency", "support", "settings", "audit", "inventory", "inventory_audit", "packing",
    "production", "accounts", "exceptions", "dispatch", "dispatch_audit",
  ],
  FINANCE_HEAD: ["dashboard", "cmd_war_room", "finance", "finance_audit", "accounts", "orders", "audit"],
  FINANCE_EXEC: ["dashboard", "cmd_war_room", "finance", "finance_audit", "accounts", "orders"],
  OPERATIONS_MANAGER: [
    "dashboard", "cmd_war_room", "orders", "production", "packing", "dispatch", "dispatch_audit", "inventory",
    "inventory_audit",
  ],
  PRODUCTION_MANAGER: ["dashboard", "orders", "production"],
  HOD_ARABIC: ["dashboard", "production", "orders"],
  HOD_FUSION: ["dashboard", "production", "orders"],
  HOD_CHOCOLATE: ["dashboard", "production", "orders"],
  HOD_BAKERY: ["dashboard", "production", "orders"],
  HOD_NUTS: ["dashboard", "production", "orders"],
  HOD_ASSEMBLY: ["dashboard", "production", "orders"],
  HOD_DRAGEES: ["dashboard", "production", "orders"],
  STORE_INCHARGE: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  STORE_READY_GOODS: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  STORE_3RD_PARTY: ["dashboard", "inventory", "orders"],
  RGS_ADMIN: ["dashboard", "cmd_war_room", "inventory", "orders", "production"],
  // Physical UAT authority: Dispatch is shipment-scoped. It must not inherit
  // general orders, CMD/War Room, store/inventory, finance, governance or gate
  // authority merely because those surfaces participate in the same order flow.
  DISPATCH_MANAGER: ["dashboard", "packing", "dispatch"],
  DISPATCH_INCHARGE: ["dashboard", "packing", "dispatch"],
  DISPATCH_HEAD: ["dashboard", "packing", "dispatch"],
  PACKING_SUPERVISOR: ["dashboard", "packing", "dispatch"],
  SECURITY_CONTROL: ["dashboard", "packing"],
  GATE_SECURITY: ["dashboard", "packing"],
  SUPPORT_EXECUTIVE: ["dashboard", "support", "exceptions", "orders"],
  ASSEMBLY_MANAGER: ["dashboard", "production", "orders"],
  PROD_ARABIC_SWEETS: ["dashboard", "production"],
  PROD_CHOCOLATE: ["dashboard", "production"],
  PROD_DRAGEES: ["dashboard", "production"],
  PROD_FUSION: ["dashboard", "production"],
  PROD_BAKERY: ["dashboard", "production"],
  PROD_NUTS: ["dashboard", "production"],
  CATALOGUE_CONTRIBUTOR: ["dashboard", "products"],
  TV_DISPLAY: ["dashboard"],
  TV_ASSEMBLY: ["dashboard"],
  TV_READY: ["dashboard"],
  SALES_EXECUTIVE: [],
  CUSTOMER_USER: [],
};

export function normalizeAppverseRole(role: string | null | undefined) {
  return role?.trim().toUpperCase() ?? null;
}

export function getAllowedModulesForRole(role: string | null | undefined): AppVerseGrantedModule[] {
  const normalized = normalizeAppverseRole(role);
  if (!normalized) return [];
  return ROLE_MODULE_ACCESS[normalized] ?? [];
}

export function hasModuleAccess(
  allowedModules: readonly string[],
  moduleKey: string,
) {
  return allowedModules.includes("*") || allowedModules.includes(moduleKey);
}
