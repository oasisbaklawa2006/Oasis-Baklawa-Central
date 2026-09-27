/**
 * Central #554 Leap 7 — Leap 13 physical UAT evidence hooks.
 * Software certification binds stable `data-testid` selectors and scenario metadata;
 * physical scanner/TV/gate PASS remains deferred until operator UAT.
 */
import {
  MACRO_ORDER_DISPATCH_JOURNEY,
  MACRO_PHYSICAL_UAT_DEFERRED,
  type MacroJourneyStage,
} from "@/lib/macro-order-dispatch/macroOrderDispatchJourney";

export const MACRO_LEAP13_UAT_HOOK = {
  ORDER_POOL: "macro-order-pool-surface",
  FINANCE_RELEASE: "macro-finance-release-surface",
  PRODUCTION_EXECUTION: "macro-production-execution-surface",
  ASSEMBLY: "macro-assembly-surface",
  READY_GOODS: "macro-ready-goods-surface",
  THREE_PGS: "macro-three-pgs-surface",
  DISPATCH_READINESS: "macro-dispatch-readiness-surface",
  PACKING_CARTON_DPL: "macro-packing-carton-surface",
  GOLDEN_CHAIN: "macro-golden-chain-surface",
  FINANCE_CLEARANCE: "macro-finance-clearance-surface",
  FINANCE_CLEARANCE_ACTION: "macro-finance-clearance-action",
  SECURITY_GATE_SCANNER: "macro-security-gate-scanner",
  SECURITY_GATE_DISPATCH_PROOF: "macro-security-gate-dispatch-proof",
  SECURITY_GATE_COMPLAINT_WINDOW: "macro-security-gate-complaint-window",
  SECURITY_GATE_CUSTOMER_COMM: "macro-security-gate-customer-comm",
  FACTORY_TV: "macro-factory-tv-surface",
} as const;

export type MacroLeap13UatHookId = (typeof MACRO_LEAP13_UAT_HOOK)[keyof typeof MACRO_LEAP13_UAT_HOOK];

export type MacroLeap13DeferredPassKey = (typeof MACRO_PHYSICAL_UAT_DEFERRED)[number];

export type MacroLeap13UatScenario = {
  id: `LEAP13-${string}`;
  title: string;
  journeyStageKey: MacroJourneyStage["key"];
  route: string;
  hookId: MacroLeap13UatHookId;
  actorRoles: readonly string[];
  passCriterion: string;
  evidenceFields: readonly string[];
  physicalDeferred: boolean;
  deferredPassKey?: MacroLeap13DeferredPassKey;
};

const stageHookByKey: Record<MacroJourneyStage["key"], MacroLeap13UatHookId> = {
  order_pool: MACRO_LEAP13_UAT_HOOK.ORDER_POOL,
  finance_release: MACRO_LEAP13_UAT_HOOK.FINANCE_RELEASE,
  production: MACRO_LEAP13_UAT_HOOK.PRODUCTION_EXECUTION,
  assembly: MACRO_LEAP13_UAT_HOOK.ASSEMBLY,
  ready_goods: MACRO_LEAP13_UAT_HOOK.READY_GOODS,
  three_pgs: MACRO_LEAP13_UAT_HOOK.THREE_PGS,
  dispatch_readiness: MACRO_LEAP13_UAT_HOOK.DISPATCH_READINESS,
  packing_dpl: MACRO_LEAP13_UAT_HOOK.PACKING_CARTON_DPL,
  golden_chain: MACRO_LEAP13_UAT_HOOK.GOLDEN_CHAIN,
  finance_exit: MACRO_LEAP13_UAT_HOOK.FINANCE_CLEARANCE,
  security_gate: MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_SCANNER,
};

export const MACRO_LEAP13_JOURNEY_HOOK_BINDINGS = MACRO_ORDER_DISPATCH_JOURNEY.map((stage) => ({
  stageKey: stage.key,
  route: stage.route,
  hookId: stageHookByKey[stage.key],
}));

export const MACRO_LEAP13_UAT_SCENARIOS: readonly MacroLeap13UatScenario[] = [
  {
    id: "LEAP13-001",
    title: "Order pool priority/owner/SLA census",
    journeyStageKey: "order_pool",
    route: "/admin/central-pool",
    hookId: MACRO_LEAP13_UAT_HOOK.ORDER_POOL,
    actorRoles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"],
    passCriterion: "Operator confirms Priority, Owner and SLA columns render for live pool rows on a physical workstation display.",
    evidenceFields: ["operator_role", "screenshot_or_capture", "sample_order_id"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-002",
    title: "Finance release board gateway",
    journeyStageKey: "finance_release",
    route: "/admin/finance-board",
    hookId: MACRO_LEAP13_UAT_HOOK.FINANCE_RELEASE,
    actorRoles: ["FINANCE_HEAD", "FINANCE_EXEC", "SUPER_ADMIN"],
    passCriterion: "Finance operator can reach the release board and identify cleared vs held orders without shadow ledger writes.",
    evidenceFields: ["operator_role", "order_id", "release_state"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-003",
    title: "Production department execution (handheld/TV)",
    journeyStageKey: "production",
    route: "/operations-controller",
    hookId: MACRO_LEAP13_UAT_HOOK.PRODUCTION_EXECUTION,
    actorRoles: ["HOD_ARABIC", "PROD_ARABIC_SWEETS", "SUPER_ADMIN"],
    passCriterion: "Physical handheld or wall-TV shows governed intake/execute queues with start/pause/complete actions.",
    evidenceFields: ["device_type", "department", "job_id", "capture_timestamp"],
    physicalDeferred: true,
    deferredPassKey: "physical_tv_pass",
  },
  {
    id: "LEAP13-004",
    title: "Packing carton scan (dispatch floor)",
    journeyStageKey: "packing_dpl",
    route: "/admin/dispatch-mgmt",
    hookId: MACRO_LEAP13_UAT_HOOK.PACKING_CARTON_DPL,
    actorRoles: ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "PACKING_SUPERVISOR"],
    passCriterion: "Physical scanner resolves carton barcode via governed RPC; duplicate/wrong barcode rejected on device.",
    evidenceFields: ["scanner_model", "carton_code", "consignment_id", "capture_timestamp"],
    physicalDeferred: true,
    deferredPassKey: "physical_scanner_pass",
  },
  {
    id: "LEAP13-005",
    title: "Finance Dispatch Clearance grant",
    journeyStageKey: "finance_exit",
    route: "/admin/accounts-release",
    hookId: MACRO_LEAP13_UAT_HOOK.FINANCE_CLEARANCE_ACTION,
    actorRoles: ["FINANCE_HEAD", "FINANCE_EXEC"],
    passCriterion: "Authorized finance actor grants Finance Dispatch Clearance only after DPL/E-way evidence is frozen.",
    evidenceFields: ["operator_role", "order_id", "clearance_timestamp", "eway_reference"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-006",
    title: "Independent security gate carton scan",
    journeyStageKey: "security_gate",
    route: "/security-gate",
    hookId: MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_SCANNER,
    actorRoles: ["SECURITY_GATE", "GATE_OPERATOR", "SUPER_ADMIN"],
    passCriterion: "Physical gate scanner releases only Finance-cleared DPL cartons; denied scans show governed reason.",
    evidenceFields: ["scanner_model", "carton_code", "gate_decision", "correlation_id"],
    physicalDeferred: true,
    deferredPassKey: "physical_gate_pass",
  },
  {
    id: "LEAP13-007",
    title: "Immutable gate-exit dispatch proof",
    journeyStageKey: "security_gate",
    route: "/security-gate",
    hookId: MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_DISPATCH_PROOF,
    actorRoles: ["SECURITY_GATE", "GATE_OPERATOR"],
    passCriterion: "After all cartons pass, operator freezes immutable dispatch proof with transporter evidence.",
    evidenceFields: ["order_id", "dispatch_proof_id", "transporter", "vehicle_number"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-008",
    title: "Customer dispatch communication + complaint window",
    journeyStageKey: "security_gate",
    route: "/security-gate",
    hookId: MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_CUSTOMER_COMM,
    actorRoles: ["SECURITY_GATE", "GATE_OPERATOR"],
    passCriterion:
      "Governed customer dispatch communication sends after proof freeze; 10-day complaint window displays OPEN anchored to final invoice date.",
    evidenceFields: ["order_id", "invoice_number", "complaint_deadline", "window_state"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-010",
    title: "P&A assembly operations surface",
    journeyStageKey: "assembly",
    route: "/admin/assembly-tasks",
    hookId: MACRO_LEAP13_UAT_HOOK.ASSEMBLY,
    actorRoles: ["ASSEMBLY_MANAGER", "PACKING_SUPERVISOR", "SUPER_ADMIN"],
    passCriterion: "Operator confirms assembly job list, component readiness and 3PGS bridge actions on governed surface.",
    evidenceFields: ["operator_role", "assembly_job_id", "capture_timestamp"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-011",
    title: "Ready Goods Store handoff visibility",
    journeyStageKey: "ready_goods",
    route: "/admin/ready-goods",
    hookId: MACRO_LEAP13_UAT_HOOK.READY_GOODS,
    actorRoles: ["STORE_READY_GOODS", "RGS_ADMIN", "SUPER_ADMIN"],
    passCriterion: "RGS operator confirms demand matching and production-to-RGS receipt evidence.",
    evidenceFields: ["operator_role", "transfer_id", "capture_timestamp"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-012",
    title: "3PGS procurement queue bridge",
    journeyStageKey: "three_pgs",
    route: "/admin/3pgs-procurement-queue",
    hookId: MACRO_LEAP13_UAT_HOOK.THREE_PGS,
    actorRoles: ["STORE_3RD_PARTY", "OPERATIONS_MANAGER", "SUPER_ADMIN"],
    passCriterion: "3PGS operator confirms vendor-shortage bridge queue and governed procurement actions.",
    evidenceFields: ["operator_role", "requirement_id", "capture_timestamp"],
    physicalDeferred: false,
  },
  {
    id: "LEAP13-009",
    title: "Factory wall-TV production truth",
    journeyStageKey: "production",
    route: "/tv/arabic-sweets",
    hookId: MACRO_LEAP13_UAT_HOOK.FACTORY_TV,
    actorRoles: ["HOD_ARABIC", "TV_DISPLAY", "SUPER_ADMIN"],
    passCriterion: "Wall-mounted TV shows governed production_jobs for the department group without stale order projection.",
    evidenceFields: ["tv_route", "department", "open_job_count", "capture_timestamp"],
    physicalDeferred: true,
    deferredPassKey: "physical_tv_pass",
  },
];

export function leap13HookSelector(hookId: MacroLeap13UatHookId): string {
  return `[data-testid="${hookId}"]`;
}

export function leap13ScenariosForStage(stageKey: MacroJourneyStage["key"]): MacroLeap13UatScenario[] {
  return MACRO_LEAP13_UAT_SCENARIOS.filter((scenario) => scenario.journeyStageKey === stageKey);
}

export function leap13DeferredScenarios(): MacroLeap13UatScenario[] {
  return MACRO_LEAP13_UAT_SCENARIOS.filter((scenario) => scenario.physicalDeferred);
}
