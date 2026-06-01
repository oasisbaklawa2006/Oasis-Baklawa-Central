import type { GoldenChainBlocker, GoldenChainStage } from "./goldenChainTypes";

const STAGE_ROUTES: Record<GoldenChainStage, string> = {
  "4b_readiness": "/admin/golden-chain-operator",
  "4c_finance": "/admin/golden-chain-operator",
  "4d_completion": "/admin/golden-chain-operator",
  "4e_dispatch_finalization": "/admin/golden-chain-operator",
  "4f_reservation": "/admin/golden-chain-operator",
  "4g_stock": "/admin/golden-chain-operator",
  complete: "/admin/golden-chain-operator",
};

const STAGE_ACTIONS: Record<GoldenChainStage, string> = {
  "4b_readiness": "Complete dispatch check (packing proof and gate scan)",
  "4c_finance": "Complete finance approval",
  "4d_completion": "Confirm dispatch completion",
  "4e_dispatch_finalization": "Finalize dispatch in the system",
  "4f_reservation": "Reserve stock for this order",
  "4g_stock": "Deduct stock after dispatch",
  complete: "No action required — this order is done",
};

const WHO_MUST_ACT: Record<GoldenChainStage, string> = {
  "4b_readiness": "Dispatch / packing team",
  "4c_finance": "Finance team",
  "4d_completion": "Dispatch supervisor",
  "4e_dispatch_finalization": "Dispatch manager",
  "4f_reservation": "Store / inventory team",
  "4g_stock": "Store / inventory team",
  complete: "No one — order complete",
};

export function whoMustActForStage(stage: GoldenChainStage): string {
  return WHO_MUST_ACT[stage];
}

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
      return "Packing proof or gate scan is still missing.";
    case "4c_finance":
      return "Finance approval is still pending for this order.";
    case "4d_completion":
      return "Dispatch completion still needs confirmation.";
    case "4e_dispatch_finalization":
      return "Dispatch has not been finalized in the system yet.";
    case "4f_reservation":
      return "Stock must be reserved before it can be deducted.";
    case "4g_stock":
      return "Stock still needs to be deducted for this dispatch.";
    default:
      return "This order cannot move forward yet.";
  }
}

function humanizeTechnicalBlocker(code: string, stage: GoldenChainStage): string {
  const map: Record<string, string> = {
    finance_signal_blocked: "Finance has blocked dispatch. Resolve payment or credit holds first.",
    finance_blocked_for_finalization: "Finance must approve this order before dispatch can be finalized.",
    completion_not_attested: "Dispatch completion confirmation is missing.",
    scan_gate_blocked: "Gate scan was rejected. Scan the carton again at Security Gate.",
    already_dispatched: "This order is already marked dispatched.",
    dispatch_not_finalized: "Dispatch must be finalized before stock can be deducted.",
    scan_reference_missing:
      "Gate scan is missing. Scan carton at Security Gate or ask dispatch supervisor.",
    gate_reference_missing: "Gate scan is missing. Scan carton at Security Gate or ask dispatch supervisor.",
    order_status_not_dispatched: "Dispatch must be finalized before stock can be deducted.",
    no_reservations: "Stock is not reserved yet. Use “Reserve stock” on this screen.",
    no_active_reservation: "Stock is not reserved yet. Use “Reserve stock” on this screen.",
    no_consumable_reservation_qty: "No stock quantity is held for this order.",
    reservation_reconciliation_variance:
      "Reserved quantities do not match the order. Ask inventory supervisor.",
    dispatch_finalize_lineage_exists:
      "Dispatch was already finalized. Continue to reserve or deduct stock if needed.",
    dispatch_already_finalized: "Dispatch was already finalized. This action was completed.",
    stock_consumption_pending: "Stock still needs to be deducted for this dispatch.",
    already_finalized:
      "This order cannot be finalized because stock has already been consumed.",
  };
  const normalized = code.toLowerCase().replace(/\s+/g, "_");
  if (map[code]) return map[code];
  if (map[normalized]) return map[normalized];
  if (code.includes("dispatchLineageId")) {
    return "Dispatch must be finalized before stock can be deducted.";
  }
  if (code.includes("scanReference") || code.includes("scan_reference")) {
    return "Gate scan is missing. Scan carton at Security Gate or ask dispatch supervisor.";
  }
  if (code === "no_active_reservation") {
    return "Reservation already exists or stock is not held — continue with the next step shown above.";
  }
  if (code.startsWith("Phase 4")) {
    return humanizeStage(stage);
  }
  if (code.startsWith("reservation_")) {
    return stage === "4f_reservation"
      ? "Cannot reserve stock yet — check finance and dispatch steps first."
      : "Reservation issue — ask inventory supervisor.";
  }
  return code.replace(/_/g, " ");
}

export function primaryRouteForStage(stage: GoldenChainStage): string {
  return STAGE_ROUTES[stage];
}
