import {
  Boxes,
  Building2,
  CircleDollarSign,
  Gauge,
  PackageSearch,
  Settings2,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AppVerseWorkspaceKey =
  | "home"
  | "customers-sales"
  | "orders-finance"
  | "operations"
  | "products-catalogue"
  | "trace-dispatch"
  | "governance";

export type AppVerseWorkspace = {
  key: AppVerseWorkspaceKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  landingPath: string;
  matchPrefixes: string[];
  moduleKeys: string[];
};

export const APPVERSE_WORKSPACES: AppVerseWorkspace[] = [
  {
    key: "home",
    label: "Home",
    shortLabel: "Home",
    description: "Role-specific command view and work requiring attention.",
    icon: Gauge,
    landingPath: "/admin",
    matchPrefixes: ["/admin"],
    moduleKeys: ["dashboard", "cmd_war_room"],
  },
  {
    key: "customers-sales",
    label: "Customers & Sales",
    shortLabel: "Customers",
    description: "Customer context, sales activity, WhatsApp, support and follow-up.",
    icon: Building2,
    landingPath: "/admin/clients",
    matchPrefixes: [
      "/admin/clients",
      "/sales",
      "/admin/operator-inbox",
      "/admin/support",
      "/admin/customer-timeline-preview",
      "/admin/operational-search",
    ],
    moduleKeys: ["clients", "support", "exceptions", "orders"],
  },
  {
    key: "orders-finance",
    label: "Orders & Finance",
    shortLabel: "Orders",
    description: "Order pipeline, commercial checks, payment, release and finance actions.",
    icon: CircleDollarSign,
    landingPath: "/admin/order-management",
    matchPrefixes: [
      "/admin/order-management",
      "/admin/accounts-release",
      "/admin/finance",
      "/admin/finance-governance",
      "/admin/pricing",
      "/admin/moq",
      "/admin/currency",
    ],
    moduleKeys: ["orders", "finance", "finance_audit", "accounts", "pricing", "moq", "currency"],
  },
  {
    key: "operations",
    label: "Operations",
    shortLabel: "Operations",
    description: "Production, assembly, inventory, ready goods, packing and dispatch command.",
    icon: Boxes,
    landingPath: "/admin/execution-command-center",
    matchPrefixes: [
      "/admin/execution-command-center",
      "/admin/execution/",
      "/admin/live-work-queues",
      "/admin/inventory-command-center",
      "/admin/reservation-board",
      "/admin/stock-finalization",
      "/admin/inventory-risk-board",
      "/admin/assembly-tasks",
      "/admin/ready-goods",
      "/admin/store-coordination",
      "/admin/dispatch-readiness",
      "/admin/dispatch-completion",
      "/admin/dispatch-finalization",
      "/admin/dispatch-mgmt",
    ],
    moduleKeys: ["production", "inventory", "inventory_audit", "packing", "dispatch", "dispatch_audit", "cmd_war_room"],
  },
  {
    key: "products-catalogue",
    label: "Products & Catalogue",
    shortLabel: "Products",
    description: "Product context, merchandising, publication status and AI Studio authority links.",
    icon: PackageSearch,
    landingPath: "/admin/products",
    matchPrefixes: [
      "/admin/products",
      "/admin/merchandising",
      "/admin/catalogue-sync",
      "/admin/catalogue-approvals",
    ],
    moduleKeys: ["products"],
  },
  {
    key: "trace-dispatch",
    label: "Trace & Dispatch",
    shortLabel: "Trace",
    description: "Cartons, labels, scan evidence, gate control and physical traceability.",
    icon: Truck,
    landingPath: "/admin/scan-timeline",
    matchPrefixes: [
      "/admin/scan-timeline",
      "/admin/carton-explorer",
      "/admin/label-command-center",
      "/security-gate",
    ],
    moduleKeys: ["dispatch", "dispatch_audit", "packing", "inventory"],
  },
  {
    key: "governance",
    label: "Governance",
    shortLabel: "More",
    description: "Users, audit, settings, system configuration and diagnostic tools.",
    icon: Settings2,
    landingPath: "/admin/settings",
    matchPrefixes: [
      "/admin/users",
      "/admin/settings",
      "/admin/audit",
      "/admin/notifications",
      "/admin/announcements",
      "/admin/display-management",
      "/admin/logistics",
      "/admin/entity-graph-explorer",
      "/admin/verification-war-room",
    ],
    moduleKeys: ["users", "settings", "audit", "cmd_war_room"],
  },
];

export function getWorkspaceForPath(pathname: string) {
  const candidates = APPVERSE_WORKSPACES.flatMap((workspace) =>
    workspace.matchPrefixes.map((prefix) => ({ workspace, prefix })),
  ).filter(
    ({ prefix }) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`) ||
      (prefix.endsWith("/") && pathname.startsWith(prefix)),
  );

  if (candidates.length === 0) return APPVERSE_WORKSPACES[0];

  candidates.sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0].workspace;
}

export function canAccessWorkspace(
  workspace: AppVerseWorkspace,
  allowedModules: string[],
) {
  if (allowedModules.includes("*")) return true;
  return workspace.moduleKeys.some((key) => allowedModules.includes(key));
}
