import { normalizeRole } from "@/lib/roleNormalization";
import {
  getAllowedModulesForRole,
  hasModuleAccess,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";

export type CentralOrderPoolLensKey =
  | "intake"
  | "pipeline"
  | "production"
  | "packing"
  | "store_coordination"
  | "label_command"
  | "third_party"
  | "accounts_release"
  | "exceptions";

export type CentralOrderPoolLens = {
  key: CentralOrderPoolLensKey;
  label: string;
  description: string;
  route: string;
  moduleKey: AppVerseModuleKey;
};

export const CENTRAL_ORDER_POOL_LENSES: CentralOrderPoolLens[] = [
  {
    key: "intake",
    label: "WhatsApp intake",
    description: "Review AI-parsed order intents and govern promotion into sales orders.",
    route: "/admin/operator-inbox",
    moduleKey: "support",
  },
  {
    key: "pipeline",
    label: "Order pipeline",
    description: "Governed commercial order progression from confirmation through delivery.",
    route: "/admin/order-management",
    moduleKey: "orders",
  },
  {
    key: "production",
    label: "Production queue",
    description: "Shop-floor orders awaiting manufacturing release or assembly.",
    route: "/admin/order-management?view=production",
    moduleKey: "production",
  },
  {
    key: "packing",
    label: "Packing & dispatch queue",
    description: "Orders in packing, finance clearance, or dispatch handoff.",
    route: "/admin/order-management?view=packing",
    moduleKey: "packing",
  },
  {
    key: "store_coordination",
    label: "Store coordination",
    description: "Inter-store transfer and fulfilment coordination.",
    route: "/admin/store-coordination",
    moduleKey: "orders",
  },
  {
    key: "label_command",
    label: "Label command center",
    description: "Carton labelling and trace label execution.",
    route: "/admin/label-command-center",
    moduleKey: "orders",
  },
  {
    key: "third_party",
    label: "Third-party board",
    description: "Third-party packing and execution queue.",
    route: "/admin/execution/third-party",
    moduleKey: "orders",
  },
  {
    key: "accounts_release",
    label: "Accounts & release",
    description: "Finance verification and commercial release gates.",
    route: "/admin/accounts-release",
    moduleKey: "accounts",
  },
  {
    key: "exceptions",
    label: "Exceptions",
    description: "Unresolved commercial or operational exceptions.",
    route: "/admin/exceptions",
    moduleKey: "exceptions",
  },
];

/** Dispatch-scoped operational roles use workflow surfaces, not the commercial order hub. */
export function isDispatchScopedOrderPoolRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD", "PACKING_SUPERVISOR"].includes(normalized);
}

export function visibleCentralOrderPoolLenses(role: string | null | undefined): CentralOrderPoolLens[] {
  if (isDispatchScopedOrderPoolRole(role)) return [];
  const allowedModules = getAllowedModulesForRole(role);
  return CENTRAL_ORDER_POOL_LENSES.filter((lens) => hasModuleAccess(allowedModules, lens.moduleKey));
}

export function canAccessCentralOrderPool(role: string | null | undefined): boolean {
  if (isDispatchScopedOrderPoolRole(role)) return false;
  return visibleCentralOrderPoolLenses(role).length > 0;
}
