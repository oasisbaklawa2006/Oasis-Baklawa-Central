import type { GoldenChainBlocker, GoldenChainStage } from "./goldenChainTypes";

const STAGE_ROUTES: Record<GoldenChainStage, string> = {
  "4b_readiness": "/admin/dispatch-readiness",
  "4c_finance": "/admin/finance-governance",
  "4d_completion": "/admin/dispatch-completion",
  "4e_dispatch_finalization": "/admin/dispatch-finalization",
  "4f_reservation": "/admin/reservation-board",
  "4g_stock": "/admin/stock-finalization",
  complete: "/admin/golden-chain-operator",
};

const STAGE_ACTIONS: Record<GoldenChainStage, string> = {
  "4b_readiness": "Complete readiness evidence and gate review",
  "4c_finance": "Run commercial finance release",
  "4d_completion": "Attest dispatch completion",
  "4e_dispatch_finalization": "Finalize governed dispatch (orders.status → dispatched)",
  "4f_reservation": "Create governed inventory reservation",
  "4g_stock": "Finalize stock consumption after dispatch",
  complete: "No action required — golden chain complete for this order",
};

export function blockersForStage(stage: GoldenChainStage, rawReasons: string[]): GoldenChainBlocker[] {
  const route = STAGE_ROUTES[stage];
  const action = STAGE_ACTIONS[stage];
  if (stage === "complete") {
    return [];
  }
  if (rawReasons.length === 0) {
    return [
      {
        message: humanizeStage(stage),
        route,
        action,
      },
    ];
  }
  return rawReasons.map((technical) => ({
    message: humanizeTechnicalBlocker(technical, stage),
    route,
    action,
    technicalDetail: technical,
  }));
}

function humanizeStage(stage: GoldenChainStage): string {
  switch (stage) {
    case "4b_readiness":
      return "Dispatch readiness (4B) is not gate-eligible yet.";
    case "4c_finance":
      return "Finance commercial release (4C) is still pending.";
    case "4d_completion":
      return "Dispatch completion attestation (4D) is required.";
    case "4e_dispatch_finalization":
      return "Dispatch finalization (4E) has not been completed.";
    case "4f_reservation":
      return "A governed inventory reservation (4F) is required before stock finalization.";
    case "4g_stock":
      return "Physical stock consumption (4G) is still pending.";
    default:
      return "Governance step pending.";
  }
}

function humanizeTechnicalBlocker(code: string, stage: GoldenChainStage): string {
  const map: Record<string, string> = {
    finance_signal_blocked: "Finance dispatch signal is blocked — resolve on Finance governance board.",
    finance_blocked_for_finalization: "Finance must be commercially released before dispatch finalization.",
    completion_not_attested: "Completion attestation missing — complete on Dispatch completion board.",
    scan_gate_blocked: "Gate scan rejected or mismatched — resolve scan evidence first.",
    already_dispatched: "Order is already dispatched.",
    dispatch_not_finalized: "Dispatch must be finalized before stock consumption.",
    scan_reference_missing: "Verified packing or gate scan reference is required.",
    gate_reference_missing: "Gate reference missing from readiness or lineage.",
    order_status_not_dispatched: "Order status must be dispatched for stock finalization.",
    no_reservations: "No inventory reservation linked to this order.",
    no_consumable_reservation_qty: "No consumable reserved quantity on this order.",
    reservation_reconciliation_variance: "Reservation quantities do not reconcile — fix on Reservation board.",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Phase 4")) return code;
  if (code.startsWith("reservation_")) {
    return stage === "4f_reservation"
      ? "Reservation prerequisite not met — create or fix reservation."
      : "Reservation reconciliation issue — review reservation quantities.";
  }
  return code.replace(/_/g, " ");
}

export function primaryRouteForStage(stage: GoldenChainStage): string {
  return STAGE_ROUTES[stage];
}
