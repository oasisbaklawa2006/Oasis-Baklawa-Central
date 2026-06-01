import type { GoldenChainBlocker, GoldenChainStage } from "./goldenChainTypes";

const STAGE_ROUTES: Record<GoldenChainStage, string> = {
  prepare_dispatch_evidence: "/admin/golden-chain-operator",
  finance_release: "/admin/golden-chain-operator",
  readiness_review: "/admin/golden-chain-operator",
  completion_attestation: "/admin/golden-chain-operator",
  dispatch_finalization: "/admin/golden-chain-operator",
  reservation: "/admin/golden-chain-operator",
  stock_finalization: "/admin/golden-chain-operator",
  complete: "/admin/golden-chain-operator",
};

const STAGE_ACTIONS: Record<GoldenChainStage, string> = {
  prepare_dispatch_evidence: "Record packing proof, documents, and gate/carton scans",
  finance_release: "Complete finance commercial release",
  readiness_review: "Run governed readiness review",
  completion_attestation: "Confirm dispatch completion",
  dispatch_finalization: "Finalize dispatch in the system",
  reservation: "Reserve stock for this order",
  stock_finalization: "Deduct stock after dispatch",
  complete: "No action required — this order is done",
};

const WHO_MUST_ACT: Record<GoldenChainStage, string> = {
  prepare_dispatch_evidence: "Dispatch / packing team",
  finance_release: "Finance team",
  readiness_review: "Dispatch supervisor",
  completion_attestation: "Dispatch supervisor",
  dispatch_finalization: "Dispatch manager",
  reservation: "Store / inventory team",
  stock_finalization: "Store / inventory team",
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
    case "prepare_dispatch_evidence":
      return "Dispatch evidence (packing, documents, scans) must be recorded first.";
    case "finance_release":
      return "Finance commercial release is required before readiness review.";
    case "readiness_review":
      return "Governed readiness review must pass before completion.";
    case "completion_attestation":
      return "Completion attestation is required before dispatch finalization.";
    case "dispatch_finalization":
      return "Dispatch must be finalized before stock reservation.";
    case "reservation":
      return "Stock must be reserved before consumption.";
    case "stock_finalization":
      return "Stock consumption must be finalized to complete the chain.";
    default:
      return "Complete the next step shown on the button.";
  }
}

function humanizeTechnicalBlocker(technical: string, stage: GoldenChainStage): string {
  const lower = technical.toLowerCase();
  if (lower.includes("carton barcode")) {
    return "Carton barcode scan is missing — use Prepare dispatch evidence.";
  }
  if (lower.includes("gate scan")) {
    return "Gate scan is missing — use Prepare dispatch evidence.";
  }
  if (lower.includes("packing")) {
    return "Verified packing photo is required.";
  }
  if (lower.includes("document")) {
    return "Document placeholder must be recorded.";
  }
  if (lower.includes("finance") || lower.includes("commercial")) {
    return stage === "finance_release"
      ? "Finance release is blocked — resolve holds on this order."
      : "Finance must release this order before readiness review.";
  }
  if (lower.includes("reservation not ready") && stage === "readiness_review") {
    return "Readiness review blocked — resolve scan and finance prerequisites first.";
  }
  if (lower.includes("no_active_reservation")) {
    return "Create a stock reservation after dispatch is finalized.";
  }
  return technical.length > 120 ? `${technical.slice(0, 117)}…` : technical;
}
