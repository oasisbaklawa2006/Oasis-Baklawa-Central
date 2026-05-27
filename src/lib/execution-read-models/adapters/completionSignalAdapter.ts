import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type {
  DispatchCompletionHoldType,
  DispatchCompletionInput,
} from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";
import { deriveSignalMeta } from "../signalStale";
import type { DerivedSignalMeta } from "../types";

export interface CompletionEvidenceSlice {
  evidenceType: string;
  evidenceStatus: string;
  createdAt: string;
}

export interface CompletionSignalFusion {
  input: DispatchCompletionInput;
  signalMeta: DerivedSignalMeta;
  missingSignals: string[];
  /** completion_attested is evidence-only — never implies orders.status dispatched */
  attestationEvidenceOnly: true;
}

export function deriveCompletionInputFromSlices(params: {
  orderId: string;
  orderStatus: string;
  readinessStatus: DispatchReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeReleaseStatus: FinanceReleaseStatus;
  reservationReady: boolean;
  scanRejected: boolean;
  scanMismatch: boolean;
  evidence: CompletionEvidenceSlice[];
}): CompletionSignalFusion {
  const missingSignals: string[] = [];
  const latestAt = params.evidence[0]?.createdAt ?? null;
  const signalMeta = deriveSignalMeta(latestAt);

  const orderAlreadyDispatched = params.orderStatus === "dispatched";
  if (orderAlreadyDispatched) {
    missingSignals.push("order_already_dispatched_observed");
  }

  const securityGatePassed =
    !params.scanRejected &&
    !params.scanMismatch &&
    params.evidence.some((e) => e.evidenceType === "completion_review" && e.evidenceStatus === "verified");

  const courierManifestAttached = params.evidence.some(
    (e) => e.evidenceType === "completion_attestation" || e.evidenceType === "completion_review",
  );

  const openCompletionHolds: DispatchCompletionHoldType[] = [];
  if (params.scanRejected) openCompletionHolds.push("security_gate_pending");
  if (params.scanMismatch) openCompletionHolds.push("readiness_regression");
  if (params.financeSignal === "blocked" || params.financeSignal === "unknown") {
    openCompletionHolds.push("finance_signal_stale");
  }

  const input: DispatchCompletionInput = {
    orderId: params.orderId,
    queueItemId: null,
    readinessStatus: params.readinessStatus,
    financeSignal: params.financeSignal === "unknown" ? "blocked" : params.financeSignal,
    financeReleaseStatus: params.financeReleaseStatus,
    reservationReady: params.reservationReady,
    orderAlreadyDispatched,
    securityGatePassed,
    courierManifestAttached,
    openCompletionHolds,
  };

  return {
    input,
    signalMeta,
    missingSignals,
    attestationEvidenceOnly: true,
  };
}

/** Explicit guard: completion attestation ≠ dispatched order status */
export function completionAttestedIsNotDispatched(
  completionStatus: string,
  orderStatus: string,
): boolean {
  if (completionStatus !== "completion_attested") return true;
  return orderStatus !== "dispatched";
}
