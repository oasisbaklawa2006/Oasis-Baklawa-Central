import { isDispatchRole } from "@/lib/auth/securityGatePolicy";
import {
  getAllowedModulesForRole,
  hasModuleAccess,
  type AppVerseModuleKey,
} from "./roleAccess";

export const GOLDEN_CHAIN_OPERATOR_ROUTE = "/admin/golden-chain-operator";
export const COMMERCIAL_DISPATCH_TV_ROUTE = "/admin/dispatch-tv";

const GOLDEN_CHAIN_OPERATOR_MODULE_KEYS: AppVerseModuleKey[] = ["dispatch", "finance", "inventory"];
const COMMERCIAL_DISPATCH_TV_KIOSK_ROLES = new Set(["TV_DISPLAY"]);

const ADMIN_ROUTE_MODULES: Array<{ prefix: string; moduleKey: AppVerseModuleKey }> = [
  { prefix: "/admin/execution/production", moduleKey: "production" },
  { prefix: "/admin/execution/assembly", moduleKey: "production" },
  { prefix: "/admin/execution/ready-goods", moduleKey: "inventory" },
  { prefix: "/admin/execution/dispatch", moduleKey: "dispatch" },
  { prefix: "/admin/execution/third-party", moduleKey: "orders" },
  { prefix: "/admin/execution/retail", moduleKey: "inventory" },
  { prefix: "/admin/execution/complaints", moduleKey: "support" },
  { prefix: "/admin/execution-command-center", moduleKey: "cmd_war_room" },
  { prefix: "/admin/execution-risk", moduleKey: "cmd_war_room" },
  { prefix: "/admin/execution-bottlenecks", moduleKey: "cmd_war_room" },
  { prefix: "/admin/live-work-queues", moduleKey: "cmd_war_room" },
  { prefix: "/admin/entity-graph-explorer", moduleKey: "cmd_war_room" },
  { prefix: "/admin/queue-execution-preview", moduleKey: "cmd_war_room" },
  { prefix: "/admin/barcode-execution-preview", moduleKey: "cmd_war_room" },
  { prefix: "/admin/product-intelligence-prototype", moduleKey: "cmd_war_room" },
  { prefix: "/admin/customer-timeline-preview", moduleKey: "cmd_war_room" },
  { prefix: "/admin/operational-search", moduleKey: "cmd_war_room" },
  { prefix: "/admin/operator-inbox", moduleKey: "support" },
  { prefix: "/admin/whatsapp", moduleKey: "support" },
  { prefix: "/admin/central-pool", moduleKey: "support" },
  { prefix: "/admin/cmd-war-room", moduleKey: "cmd_war_room" },
  { prefix: "/admin/verification", moduleKey: "cmd_war_room" },
  { prefix: "/admin/support", moduleKey: "support" },
  { prefix: "/admin/clients", moduleKey: "clients" },
  { prefix: "/admin/customers", moduleKey: "clients" },
  { prefix: "/admin/crm", moduleKey: "clients" },
  { prefix: "/admin/approvals", moduleKey: "clients" },
  { prefix: "/admin/products", moduleKey: "products" },
  { prefix: "/admin/merchandising", moduleKey: "products" },
  { prefix: "/admin/catalogue-sync", moduleKey: "products" },
  { prefix: "/admin/catalogue-approvals", moduleKey: "products" },
  { prefix: "/admin/pricing", moduleKey: "pricing" },
  { prefix: "/admin/moq", moduleKey: "moq" },
  { prefix: "/admin/currency", moduleKey: "currency" },
  { prefix: "/admin/finance-governance", moduleKey: "finance_audit" },
  { prefix: "/admin/finance-board", moduleKey: "finance" },
  { prefix: "/admin/finance", moduleKey: "finance" },
  { prefix: "/admin/accounts-release", moduleKey: "accounts" },
  { prefix: "/admin/order-management", moduleKey: "orders" },
  { prefix: "/admin/orders", moduleKey: "orders" },
  { prefix: "/admin/store-coordination", moduleKey: "orders" },
  { prefix: "/admin/label-command-center", moduleKey: "orders" },
  { prefix: "/admin/exceptions", moduleKey: "exceptions" },
  { prefix: "/admin/production", moduleKey: "production" },
  { prefix: "/admin/assembly-tasks", moduleKey: "production" },
  { prefix: "/admin/assembly", moduleKey: "production" },
  { prefix: "/admin/operations", moduleKey: "production" },
  { prefix: "/admin/inventory-command-center", moduleKey: "inventory" },
  { prefix: "/admin/inventory-receiving", moduleKey: "inventory" },
  { prefix: "/admin/carton-explorer", moduleKey: "inventory" },
  { prefix: "/admin/inventory-risk-board", moduleKey: "inventory" },
  { prefix: "/admin/scan-timeline", moduleKey: "inventory" },
  { prefix: "/admin/ready-goods", moduleKey: "inventory" },
  { prefix: "/admin/ready-goods-stock", moduleKey: "inventory" },
  { prefix: "/admin/ready-goods-day-close", moduleKey: "inventory" },
  { prefix: "/admin/ready-goods-reports", moduleKey: "inventory" },
  { prefix: "/admin/production-demand-planner", moduleKey: "production" },
  { prefix: "/admin/assembly-tv", moduleKey: "production" },
  { prefix: "/admin/rgs-tv", moduleKey: "inventory" },
  { prefix: "/admin/3pgs-packing-material", moduleKey: "inventory" },
  { prefix: "/admin/3pgs-procurement-queue", moduleKey: "inventory" },
  { prefix: "/admin/3pgs-visibility", moduleKey: "inventory" },
  { prefix: "/admin/3pgs-mobile-urgent", moduleKey: "inventory" },
  { prefix: "/admin/3pgs-tv", moduleKey: "inventory" },
  { prefix: "/admin/inventory", moduleKey: "inventory" },
  { prefix: "/admin/reservation-board", moduleKey: "inventory_audit" },
  { prefix: "/admin/stock-finalization", moduleKey: "inventory_audit" },
  { prefix: "/admin/packing-dispatch", moduleKey: "orders" },
  { prefix: "/admin/dispatch-mgmt", moduleKey: "packing" },
  { prefix: "/admin/dispatch-readiness", moduleKey: "dispatch" },
  { prefix: "/admin/dispatch-completion", moduleKey: "dispatch" },
  { prefix: "/admin/dispatch-finalization", moduleKey: "dispatch" },
  { prefix: "/admin/dispatch-tv", moduleKey: "orders" },
  { prefix: "/admin/dispatch", moduleKey: "orders" },
  { prefix: "/admin/golden-chain-operator", moduleKey: "dispatch" },
  { prefix: "/admin/users", moduleKey: "users" },
  { prefix: "/admin/roles", moduleKey: "users" },
  { prefix: "/admin/settings", moduleKey: "settings" },
  { prefix: "/admin/logistics", moduleKey: "settings" },
  { prefix: "/admin/notifications", moduleKey: "settings" },
  { prefix: "/admin/announcements", moduleKey: "settings" },
  { prefix: "/admin/display-management", moduleKey: "settings" },
  { prefix: "/admin/audit", moduleKey: "audit" },
  { prefix: "/admin/department", moduleKey: "audit" },
  { prefix: "/admin/target-vs-actual", moduleKey: "cmd_war_room" },
  { prefix: "/admin/heartbeat", moduleKey: "cmd_war_room" },
  { prefix: "/admin/sales-hub", moduleKey: "cmd_war_room" },
  { prefix: "/admin/3pcs-store", moduleKey: "inventory" },
  { prefix: "/admin", moduleKey: "dashboard" },
];

/** The AppVerse module an admin route belongs to, chosen by the longest matching prefix; null outside /admin. */
export function getRequiredModuleForAdminPath(pathname: string): AppVerseModuleKey | null {
  if (!pathname.startsWith("/admin")) return null;
  const matches = ADMIN_ROUTE_MODULES.filter(({ prefix }) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0]?.moduleKey ?? null;
}

function isGoldenChainOperatorPath(pathname: string): boolean {
  return pathname === GOLDEN_CHAIN_OPERATOR_ROUTE || pathname.startsWith(`${GOLDEN_CHAIN_OPERATOR_ROUTE}/`);
}

function isCommercialDispatchTvPath(pathname: string): boolean {
  return pathname === COMMERCIAL_DISPATCH_TV_ROUTE || pathname.startsWith(`${COMMERCIAL_DISPATCH_TV_ROUTE}/`);
}

/** Kiosk TV_DISPLAY gets dispatch-tv only; other roles use standard orders module authority. */
export function canAccessCommercialDispatchTvRoute(role: string | null | undefined): boolean {
  const normalized = role?.trim().toUpperCase();
  if (!normalized) return false;
  if (COMMERCIAL_DISPATCH_TV_KIOSK_ROLES.has(normalized)) return true;
  return hasModuleAccess(getAllowedModulesForRole(role), "orders");
}

/** Phase 24L pilot: finance and inventory operators share the wizard with dispatch. */
export function canAccessGoldenChainOperatorRoute(role: string | null | undefined): boolean {
  const allowedModules = getAllowedModulesForRole(role);
  return GOLDEN_CHAIN_OPERATOR_MODULE_KEYS.some((moduleKey) => hasModuleAccess(allowedModules, moduleKey));
}

/** Complete AdminRouteGuard authorization for a concrete /admin path and role. */
export function isAuthorizedForAdminPath(pathname: string, role: string | null | undefined): boolean {
  if (!pathname.startsWith("/admin")) return true;
  if (isGoldenChainOperatorPath(pathname)) return canAccessGoldenChainOperatorRoute(role);
  if (isCommercialDispatchTvPath(pathname)) return canAccessCommercialDispatchTvRoute(role);
  const requiredModule = getRequiredModuleForAdminPath(pathname);
  // P0 #456: Dispatch roles may use App-Verse home (/admin) only via dashboard;
  // any other unmapped /admin path that falls back to dashboard must fail closed.
  if (isDispatchRole(role) && requiredModule === "dashboard" && pathname !== "/admin") {
    return false;
  }
  const allowedModules = getAllowedModulesForRole(role);
  return requiredModule !== null && hasModuleAccess(allowedModules, requiredModule);
}
