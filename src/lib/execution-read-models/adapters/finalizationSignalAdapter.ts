import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { DispatchCompletionStatus } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";
import { deriveSignalMeta } from "../signalStale";
import type { DerivedSignalMeta } from "../types";

export interface FinalizationLineageSlice {
  releaseType: string;
  nextStatus: string;
  createdAt: string;
}

export interface FinalizationSignalFusion {
  input: DispatchFinalizationInput;
  signalMeta: DerivedSignalMeta;
  missingSignals: string[];
}

export function deriveFinalizationInputFromSlices(params: {
  orderId: string;
  currentOrderStatus: string;
  readinessStatus: DispatchReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeReleaseStatus: FinanceReleaseStatus;
  completionStatus: DispatchCompletionStatus;
  reservationReady: boolean;
  transporterReference: string | null;
  gateReference: string | null;
  completionReference: string | null;
  lineage: FinalizationLineageSlice[];
  financeBlocked: boolean;
  scanBlocked: boolean;
}): FinalizationSignalFusion {
  const missingSignals: string[] = [];
  const latestAt = params.lineage[0]?.createdAt ?? null;
  const signalMeta = deriveSignalMeta(latestAt);

  const openReleaseBlockers: string[] = [];
  if (params.financeBlocked || params.financeSignal === "blocked" || params.financeSignal === "unknown") {
    openReleaseBlockers.push("finance_signal_blocked");
    missingSignals.push("finance_blocked_for_finalization");
  }
  if (params.scanBlocked) {
    openReleaseBlockers.push("scan_gate_blocked");
  }
  if (params.completionStatus !== "completion_attested") {
    openReleaseBlockers.push("completion_not_attested");
  }
  if (params.currentOrderStatus === "dispatched") {
    openReleaseBlockers.push("already_dispatched");
  }

  const transporterHandoffFinalized = Boolean(params.transporterReference?.trim());

  const input: DispatchFinalizationInput = {
    orderId: params.orderId,
    currentOrderStatus: params.currentOrderStatus,
    readinessStatus: params.readinessStatus,
    financeSignal: params.financeSignal === "unknown" ? "blocked" : params.financeSignal,
    financeReleaseStatus: params.financeReleaseStatus,
    completionStatus: params.completionStatus,
    reservationReady: params.reservationReady,
    transporterHandoffFinalized,
    gateReference: params.gateReference,
    completionReference: params.completionReference,
    transporterReference: params.transporterReference,
    openReleaseBlockers,
  };

  return { input, signalMeta, missingSignals };
}
