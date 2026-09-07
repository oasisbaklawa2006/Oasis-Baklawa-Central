/**
 * Central #554 Leap 7 — canonical internal order-to-gate journey stages.
 * Read-only census used by closure tests and macro E2E route probes.
 */

export type MacroJourneyStage = {
  key: string;
  label: string;
  route: string;
  moduleKey: string;
  absorbedPoints: readonly string[];
};

export const MACRO_ORDER_DISPATCH_JOURNEY: readonly MacroJourneyStage[] = [
  {
    key: "order_pool",
    label: "Order Pool",
    route: "/admin/central-pool",
    moduleKey: "cmd_war_room",
    absorbedPoints: ["POINT71", "POINT74"],
  },
  {
    key: "finance_release",
    label: "Finance Release",
    route: "/admin/finance-board",
    moduleKey: "finance",
    absorbedPoints: ["POINT77", "POINT79", "POINT80"],
  },
  {
    key: "production",
    label: "Production Execution",
    route: "/operations-controller",
    moduleKey: "production",
    absorbedPoints: ["POINT86", "POINT87", "POINT88", "POINT89"],
  },
  {
    key: "assembly",
    label: "P&A Assembly",
    route: "/admin/assembly-tasks",
    moduleKey: "production",
    absorbedPoints: ["POINT90"],
  },
  {
    key: "ready_goods",
    label: "Ready Goods Store",
    route: "/admin/ready-goods",
    moduleKey: "inventory",
    absorbedPoints: ["RGS"],
  },
  {
    key: "three_pgs",
    label: "3PGS Procurement",
    route: "/admin/3pgs-procurement-queue",
    moduleKey: "orders",
    absorbedPoints: ["3PGS"],
  },
  {
    key: "packing_dpl",
    label: "Packing / Carton / DPL",
    route: "/admin/dispatch-mgmt",
    moduleKey: "dispatch",
    absorbedPoints: ["POINT92"],
  },
  {
    key: "finance_exit",
    label: "Finance Dispatch Clearance",
    route: "/admin/accounts-release",
    moduleKey: "accounts",
    absorbedPoints: ["POINT77"],
  },
  {
    key: "security_gate",
    label: "Security Gate",
    route: "/security-gate",
    moduleKey: "dispatch",
    absorbedPoints: ["GATE"],
  },
];

export const MACRO_AMENDMENT_SURFACE = "/admin/order-management";
export const MACRO_DISPATCH_MANAGER_HOME = "/admin/dispatch-mgmt";

export const MACRO_PHYSICAL_UAT_DEFERRED = [
  "physical_scanner_pass",
  "physical_tv_pass",
  "physical_gate_pass",
] as const;
