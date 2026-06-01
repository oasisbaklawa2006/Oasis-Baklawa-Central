import { isFinanceSignalReady } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type {
  DispatchFinalizationInput,
  DispatchFinalizationPolicy,
  DispatchReleaseStatus,
} from "./dispatchFinalizationTypes";

export function isPreDispatchWizardFinalizationPolicy(
  policy: DispatchFinalizationPolicy | undefined,
): boolean {
  return policy === "pre_dispatch_wizard";
}

export function deriveDispatchReleaseStatus(input: DispatchFinalizationInput): DispatchReleaseStatus {
  const current = input.currentOrderStatus.trim().toLowerCase();
  if (current === "dispatched" || current === "in_transit" || current === "delivered") {
    return "dispatch_finalized";
  }

  if (input.openReleaseBlockers.length > 0) {
    return "dispatch_release_blocked";
  }

  const gateOk = input.readinessStatus === "gate_eligible";
  const financeOk = isFinanceSignalReady(input.financeSignal);
  const commercialOk = input.financeReleaseStatus === "commercially_released";
  const completionOk = input.completionStatus === "completion_attested";
  const wizard = isPreDispatchWizardFinalizationPolicy(input.finalizationPolicy);
  const reservationOk = wizard ? true : input.reservationReady;
  const transportOk = input.transporterHandoffFinalized;
  const gateRefOk = Boolean(input.gateReference?.trim());
  const completionRefOk = Boolean(input.completionReference?.trim());

  if (!gateOk || !financeOk || !commercialOk || !completionOk || !reservationOk) {
    return "dispatch_release_pending";
  }

  if (!transportOk || !gateRefOk || !completionRefOk) {
    return "dispatch_release_pending";
  }

  return "dispatch_release_ready";
}

export function buildReleaseBlockingReasons(input: DispatchFinalizationInput): string[] {
  const reasons: string[] = [...input.openReleaseBlockers];

  if (input.readinessStatus !== "gate_eligible") {
    reasons.push(`Phase 4B: readiness must be gate_eligible (got ${input.readinessStatus})`);
  }
  if (!isFinanceSignalReady(input.financeSignal)) {
    reasons.push("Phase 4C: finance dispatch signal not ready");
  }
  if (input.financeReleaseStatus !== "commercially_released") {
    reasons.push(`Phase 4C: requires commercially_released (got ${input.financeReleaseStatus})`);
  }
  if (input.completionStatus !== "completion_attested") {
    reasons.push(`Phase 4D: requires completion_attested (got ${input.completionStatus})`);
  }
  if (!isPreDispatchWizardFinalizationPolicy(input.finalizationPolicy) && !input.reservationReady) {
    reasons.push("Phase 4A: reservation not ready");
  }
  if (!input.transporterHandoffFinalized) {
    reasons.push("Transporter handoff not finalized");
  }
  if (!input.gateReference?.trim()) {
    reasons.push("Gate reference missing on finalization record");
  }
  if (!input.completionReference?.trim()) {
    reasons.push("Completion attestation reference missing");
  }
  if (input.openReleaseBlockers.includes("dispatch_already_finalized")) {
    reasons.push("Dispatch already finalized — dispatch_release_lineage release_type=finalize exists");
  }

  return reasons;
}

export function buildReleaseWarnings(status: DispatchReleaseStatus): string[] {
  const warnings: string[] = [];
  if (status === "dispatch_release_ready") {
    warnings.push("Finalize will mutate orders.status → dispatched via governed repository only");
    warnings.push("No payment capture, invoicing, or stock deduction in this phase");
  }
  if (status === "dispatch_finalized") {
    warnings.push("Customer publication may show Dispatched / In transit only after publish action");
  }
  return warnings;
}

export function buildReleaseRecommendation(status: DispatchReleaseStatus): string {
  switch (status) {
    case "dispatch_release_ready":
      return "Eligible for governed finalize — dispatch head or manager with authority";
    case "dispatch_release_blocked":
      return "Resolve blockers before finalize";
    case "dispatch_release_pending":
      return "Complete 4B + 4C + 4D chain and transporter handoff";
    case "dispatch_finalized":
      return "Published customer release optional; reversal requires dispatch head";
    case "dispatch_reversal_pending":
      return "Reversal in progress — compensating events only";
    case "dispatch_reversed":
      return "Reversal recorded — no lineage delete";
    default:
      return "Review dispatch release eligibility";
  }
}
