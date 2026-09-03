import type { AppVerseModuleKey } from "./roleAccess";

export type RoleHomeCardKind = "metric" | "queue" | "alert" | "shortcut";

export type RoleHomeCard = {
  key: string;
  label: string;
  kind: RoleHomeCardKind;
  route: string;
  moduleKey: AppVerseModuleKey;
  priority: 1 | 2 | 3;
};

export type RoleHomeDefinition = {
  title: string;
  subtitle: string;
  cards: RoleHomeCard[];
};

const executive: RoleHomeDefinition = { title: "Command overview", subtitle: "Business signals, exceptions and work requiring intervention.", cards: [
  { key: "orders", label: "Order pipeline", kind: "metric", route: "/admin/order-management", moduleKey: "orders", priority: 1 },
  { key: "finance", label: "Finance attention", kind: "alert", route: "/admin/finance", moduleKey: "finance", priority: 1 },
  { key: "operations", label: "Execution command", kind: "queue", route: "/admin/execution-command-center", moduleKey: "cmd_war_room", priority: 1 },
  { key: "customers", label: "Customers & follow-up", kind: "shortcut", route: "/admin/clients", moduleKey: "clients", priority: 2 },
  { key: "whatsapp", label: "WhatsApp attention", kind: "queue", route: "/admin/operator-inbox", moduleKey: "support", priority: 2 },
  { key: "inventory", label: "Inventory risk", kind: "alert", route: "/admin/inventory-risk-board", moduleKey: "inventory", priority: 2 },
] };

const operations: RoleHomeDefinition = { title: "Operations today", subtitle: "Queues, blockers and the next physical execution actions.", cards: [
  { key: "execution", label: "Execution queue", kind: "queue", route: "/admin/execution-command-center", moduleKey: "cmd_war_room", priority: 1 },
  { key: "production", label: "Production board", kind: "queue", route: "/admin/execution/production", moduleKey: "production", priority: 1 },
  { key: "packing", label: "Packing & dispatch", kind: "queue", route: "/admin/order-management?view=packing", moduleKey: "packing", priority: 1 },
  { key: "inventory", label: "Inventory risk", kind: "alert", route: "/admin/inventory-risk-board", moduleKey: "inventory", priority: 2 },
  { key: "ready-goods", label: "Ready goods", kind: "metric", route: "/admin/ready-goods", moduleKey: "inventory", priority: 2 },
] };

const finance: RoleHomeDefinition = { title: "Finance today", subtitle: "Collections, release decisions and exceptions requiring action.", cards: [
  { key: "finance", label: "Finance queue", kind: "queue", route: "/admin/finance", moduleKey: "finance", priority: 1 },
  { key: "release", label: "Accounts & release", kind: "queue", route: "/admin/accounts-release", moduleKey: "accounts", priority: 1 },
  { key: "orders", label: "Order commercial status", kind: "metric", route: "/admin/order-management", moduleKey: "orders", priority: 2 },
  { key: "audit", label: "Finance audit", kind: "shortcut", route: "/admin/finance-governance", moduleKey: "finance_audit", priority: 3 },
] };

const dispatch: RoleHomeDefinition = { title: "Dispatch today", subtitle: "Readiness, packing, trace evidence and gate completion.", cards: [
  { key: "golden-chain", label: "Golden Chain Operator", kind: "queue", route: "/admin/golden-chain-operator", moduleKey: "dispatch", priority: 1 },
  { key: "dispatch", label: "Dispatch board", kind: "queue", route: "/admin/dispatch-mgmt", moduleKey: "dispatch", priority: 1 },
  { key: "readiness", label: "Dispatch readiness", kind: "alert", route: "/admin/dispatch-readiness", moduleKey: "dispatch", priority: 1 },
  { key: "completion", label: "Dispatch completion", kind: "shortcut", route: "/admin/dispatch-completion", moduleKey: "dispatch", priority: 2 },
  { key: "gate", label: "Security gate", kind: "shortcut", route: "/security-gate", moduleKey: "packing", priority: 2 },
] };

const support: RoleHomeDefinition = { title: "Customer attention", subtitle: "Messages, support cases, exceptions and order context requiring response.", cards: [
  { key: "whatsapp", label: "WhatsApp inbox", kind: "queue", route: "/admin/operator-inbox", moduleKey: "support", priority: 1 },
  { key: "support", label: "Support tickets", kind: "queue", route: "/admin/support", moduleKey: "support", priority: 1 },
  { key: "exceptions", label: "Exceptions", kind: "alert", route: "/admin/exceptions", moduleKey: "exceptions", priority: 1 },
  { key: "orders", label: "Order context", kind: "shortcut", route: "/admin/order-management", moduleKey: "orders", priority: 2 },
] };

const production: RoleHomeDefinition = { title: "Production today", subtitle: "Only production work, blockers and relevant order context.", cards: [
  { key: "production", label: "Production board", kind: "queue", route: "/admin/execution/production", moduleKey: "production", priority: 1 },
  { key: "orders", label: "Order requirements", kind: "shortcut", route: "/admin/order-management?view=production", moduleKey: "orders", priority: 2 },
] };

const store: RoleHomeDefinition = { title: "Store today", subtitle: "Inventory availability, reservations and production requirements.", cards: [
  { key: "inventory", label: "Inventory command", kind: "queue", route: "/admin/inventory-command-center", moduleKey: "inventory", priority: 1 },
  { key: "risk", label: "Inventory risk", kind: "alert", route: "/admin/inventory-risk-board", moduleKey: "inventory", priority: 1 },
  { key: "production", label: "Production demand", kind: "shortcut", route: "/admin/execution/production", moduleKey: "production", priority: 2 },
] };

const catalogue: RoleHomeDefinition = { title: "Catalogue work", subtitle: "Product records, merchandising and catalogue publication work only.", cards: [
  { key: "products", label: "Products", kind: "queue", route: "/admin/products", moduleKey: "products", priority: 1 },
  { key: "approvals", label: "Catalogue approvals", kind: "queue", route: "/admin/catalogue-approvals", moduleKey: "products", priority: 1 },
  { key: "sync", label: "Catalogue sync", kind: "shortcut", route: "/admin/catalogue-sync", moduleKey: "products", priority: 2 },
] };

const gate: RoleHomeDefinition = { title: "Gate control", subtitle: "Physical gate actions and packing evidence only.", cards: [
  { key: "gate", label: "Security gate", kind: "queue", route: "/security-gate", moduleKey: "packing", priority: 1 },
] };

const displayOnly: RoleHomeDefinition = { title: "Display mode", subtitle: "This role is intended for operational display surfaces rather than command actions.", cards: [] };
const noAppverse: RoleHomeDefinition = { title: "No Central workspace", subtitle: "This role uses a dedicated application surface and has no Central command actions.", cards: [] };

const ROLE_HOME: Record<string, RoleHomeDefinition> = {
  SUPER_ADMIN: executive, ADMIN: executive,
  FINANCE_HEAD: finance, FINANCE_EXEC: finance,
  OPERATIONS_MANAGER: operations,
  PRODUCTION_MANAGER: production, HOD_ARABIC: production, HOD_FUSION: production, HOD_CHOCOLATE: production, HOD_BAKERY: production, HOD_NUTS: production, HOD_ASSEMBLY: production, HOD_DRAGEES: production,
  ASSEMBLY_MANAGER: production, PROD_ARABIC_SWEETS: production, PROD_CHOCOLATE: production, PROD_DRAGEES: production, PROD_FUSION: production, PROD_BAKERY: production, PROD_NUTS: production,
  STORE_INCHARGE: store, STORE_READY_GOODS: store, STORE_3RD_PARTY: store, RGS_ADMIN: store,
  DISPATCH_MANAGER: dispatch, DISPATCH_INCHARGE: dispatch, DISPATCH_HEAD: dispatch, PACKING_SUPERVISOR: dispatch,
  SUPPORT_EXECUTIVE: support,
  SECURITY_CONTROL: gate, GATE_SECURITY: gate,
  CATALOGUE_CONTRIBUTOR: catalogue,
  TV_DISPLAY: displayOnly, TV_ASSEMBLY: displayOnly, TV_READY: displayOnly,
  SALES_EXECUTIVE: noAppverse, CUSTOMER_USER: noAppverse,
};

export function getRoleHomeDefinition(role: string | null | undefined): RoleHomeDefinition {
  if (!role) return executive;
  return ROLE_HOME[role.trim().toUpperCase()] ?? executive;
}

export function getVisibleRoleHomeCards(role: string | null | undefined, allowedModules: readonly string[]): RoleHomeCard[] {
  const definition = getRoleHomeDefinition(role);
  const hasAll = allowedModules.includes("*");
  return definition.cards.filter((card) => hasAll || allowedModules.includes(card.moduleKey)).sort((a, b) => a.priority - b.priority);
}
