import { isFinanceSignalBlocking, isFinanceSignalReady } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type {
  DispatchCompletionInput,
  DispatchCompletionStatus,
} from "./dispatchCompletionTypes";

export function deriveDispatchCompletionStatus(input: DispatchCompletionInput): DispatchCompletionStatus {
  if (input.orderAlreadyDispatched) return "already_dispatched";

  if (input.openCompletionHolds.length > 0) return "completion_blocked";

  const gateOk = input.readinessStatus === "gate_eligible";
  const financeOk = isFinanceSignalReady(input.financeSignal);
  const releaseOk =
    input.financeReleaseStatus === "commercially_released" ||
    input.financeReleaseStatus === "finance_conditionally_ready";
  const reservationOk = input.reservationReady;
  const securityOk = input.securityGatePassed;
  const manifestOk = input.courierManifestAttached;

  if (!gateOk || !financeOk || !reservationOk) {
    return "prerequisites_pending";
  }

  if (!releaseOk || !securityOk || !manifestOk) {
    return "not_eligible";
  }

  return "completion_eligible";
}

export function buildCompletionBlockingReasons(input: DispatchCompletionInput): string[] {
  const reasons: string[] = [];

  if (input.orderAlreadyDispatched) {
    reasons.push("Order already marked dispatched in operational systems");
  }
  if (input.readinessStatus !== "gate_eligible") {
    reasons.push(`Dispatch readiness is ${input.readinessStatus}, requires gate_eligible`);
  }
  if (isFinanceSignalBlocking(input.financeSignal)) {
    reasons.push("Finance dispatch signal blocked");
  }
  if (!input.reservationReady) {
    reasons.push("Inventory reservation not ready");
  }
  if (
    input.financeReleaseStatus !== "commercially_released" &&
    input.financeReleaseStatus !== "finance_conditionally_ready"
  ) {
    reasons.push(`Finance release status: ${input.financeReleaseStatus}`);
  }
  if (!input.securityGatePassed) {
    reasons.push("Security gate clearance not recorded");
  }
  if (!input.courierManifestAttached) {
    reasons.push("Courier manifest / handoff reference missing");
  }
  for (const hold of input.openCompletionHolds) {
    reasons.push(`Completion hold: ${hold}`);
  }

  return reasons;
}

export function buildCompletionWarnings(status: DispatchCompletionStatus): string[] {
  const warnings: string[] = [];
  if (status === "completion_eligible") {
    warnings.push("Completion eligible — attestation records governance only");
    warnings.push("Attestation does NOT set orders.status to dispatched");
    warnings.push("Attestation does NOT deduct stock or generate invoices");
  }
  if (status === "completion_attested") {
    warnings.push("Completion attested — downstream order mutation requires separate governed PR");
  }
  return warnings;
}

export function buildCompletionRecommendation(status: DispatchCompletionStatus): string {
  switch (status) {
    case "already_dispatched":
      return "No action — order already dispatched";
    case "completion_blocked":
      return "Resolve completion holds before review";
    case "prerequisites_pending":
      return "Complete Phase 4B readiness and Phase 4C finance signals";
    case "not_eligible":
      return "Record security gate and courier manifest placeholders before attestation";
    case "completion_eligible":
      return "Dispatch manager may attest completion (append-only evidence)";
    case "completion_attested":
      return "Attestation on file — handoff to legacy dispatch paths only via future authority PR";
    default:
      return "Review dispatch completion prerequisites";
  }
}
