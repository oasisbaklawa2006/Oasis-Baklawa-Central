import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type { FinanceGovernanceInput, FinanceHoldType } from "@/lib/finance-governance/financeGovernanceTypes";
import { deriveSignalMeta, downgradeIfStale } from "../signalStale";
import type { DerivedSignalMeta } from "../types";

export interface FinanceEvidenceSlice {
  reviewStatus: string;
  reviewType: string;
  createdAt: string;
}

export interface FinanceOrderSlice {
  orderId: string;
  orderValue: number;
  advanceRequired: number;
  advanceVerified: boolean;
  paymentStatus: string | null;
  updatedAt: string | null;
}

export interface FinanceSignalFusion {
  input: FinanceGovernanceInput;
  financeSignal: FinanceDispatchSignal;
  signalMeta: DerivedSignalMeta;
  missingSignals: string[];
}

const BLOCKING_REVIEW = new Set(["rejected", "blocked"]);
const POSITIVE_REVIEW = new Set(["verified", "released"]);

export function deriveFinanceSignalFromSlices(
  order: FinanceOrderSlice,
  evidence: FinanceEvidenceSlice[],
  options?: { dispatchReadinessGateEligible?: boolean; reservationReady?: boolean },
): FinanceSignalFusion {
  const missingSignals: string[] = [];
  const latestEvidenceAt = evidence[0]?.createdAt ?? order.updatedAt;
  const signalMeta = deriveSignalMeta(latestEvidenceAt);

  const rejectionCount = evidence.filter((e) => e.reviewStatus === "rejected").length;
  const hasBlockedEvidence = evidence.some((e) => BLOCKING_REVIEW.has(e.reviewStatus));
  const hasPositiveRelease = evidence.some(
    (e) => POSITIVE_REVIEW.has(e.reviewStatus) && e.reviewType === "commercial_release",
  );

  const openHoldTypes: FinanceHoldType[] = [];
  if (order.advanceRequired > 0 && !order.advanceVerified) {
    openHoldTypes.push("advance_unverified");
  }
  if (order.paymentStatus === "balance_due") {
    openHoldTypes.push("commercial_dispute");
  }

  if (evidence.length === 0) missingSignals.push("finance_review_evidence");

  let financeSignal: FinanceDispatchSignal = "unknown";

  if (hasBlockedEvidence || rejectionCount > 0 || openHoldTypes.length > 0) {
    financeSignal = "blocked";
  } else if (signalMeta.stale) {
    financeSignal = "pending_review";
  } else if (hasPositiveRelease && openHoldTypes.length === 0 && order.advanceVerified) {
    financeSignal = "ready";
  } else if (evidence.length > 0) {
    financeSignal = "pending_review";
  } else {
    financeSignal = "unknown";
  }

  financeSignal = downgradeIfStale(
    financeSignal,
    signalMeta,
    "ready",
    "blocked",
    "pending_review",
  );

  if (financeSignal === "unknown") {
    missingSignals.push("finance_signal_unresolved");
  }

  const input: FinanceGovernanceInput = {
    orderId: order.orderId,
    orderValue: order.orderValue,
    advanceRequired: order.advanceRequired,
    advanceVerified: order.advanceVerified,
    creditApproved: true,
    openHoldTypes,
    reservationReady: options?.reservationReady ?? true,
    dispatchReadinessGateEligible: options?.dispatchReadinessGateEligible ?? false,
    complaintSeverity: "none",
    staleFinanceReview: signalMeta.stale,
    manualOverrideCount: 0,
    rejectionCount,
    escalationCount: 0,
  };

  return { input, financeSignal, signalMeta, missingSignals };
}
