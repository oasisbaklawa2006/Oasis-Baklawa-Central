import { describe, expect, it } from "vitest";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import {
  deriveGoldenChainStage,
  type GoldenChainDerivationInput,
} from "../goldenChainStageDerivation";
import {
  goldenChainAdvancedPastDispatchFinalize,
  goldenChainPastDispatchFinalize,
} from "../goldenChainReloadAfterMutation";
import type { GoldenChainOrderState } from "../goldenChainTypes";

const orderId = "b12e0115-1203-47d8-991d-e419812b0001";

const verifiedEvidence = [
  { evidenceType: "packing_photo", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "document_placeholder", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "gate_scan", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  {
    evidenceType: "manual_readiness_review",
    evidenceStatus: "verified",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

const verifiedScan = {
  hasUnresolvedMismatch: false,
  hasRejectedGateScan: false,
  gateScanVerified: true,
  cartonBarcodeVerified: true,
  latestAt: "2026-01-01T00:00:00Z",
};

const readyInput: DispatchReadinessInput = {
  orderId,
  queue: { queueItemId: null, isActive: true, isCompleted: false, hasVersionConflict: false },
  scan: {
    hasUnresolvedMismatch: false,
    hasRejectedGateScan: false,
    gateScanVerified: true,
    cartonBarcodeVerified: true,
  },
  reservationStatus: "none",
  financeSignal: "ready",
  packingEvidenceVerified: true,
  documentPlaceholderPresent: true,
  openExceptionTypes: [],
  readinessPolicy: "pre_dispatch",
};

const financeReady: FinanceGovernanceInput = {
  orderId,
  orderValue: 100_000,
  advanceRequired: 30_000,
  advanceVerified: true,
  creditApproved: true,
  openHoldTypes: [],
  reservationReady: true,
  dispatchReadinessGateEligible: true,
  complaintSeverity: "none",
  staleFinanceReview: false,
  manualOverrideCount: 0,
  rejectionCount: 0,
  escalationCount: 0,
};

const completionReady: DispatchCompletionInput = {
  orderId,
  queueItemId: null,
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  reservationReady: false,
  orderAlreadyDispatched: false,
  securityGatePassed: true,
  courierManifestAttached: true,
  openCompletionHolds: [],
  completionPolicy: "pre_dispatch_wizard",
};

const finalizationReady: DispatchFinalizationInput = {
  orderId,
  currentOrderStatus: "cleared_for_dispatch",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  completionStatus: "completion_attested",
  reservationReady: true,
  transporterHandoffFinalized: true,
  gateReference: "GATE-1",
  completionReference: "ATT-1",
  transporterReference: "TRANS-1",
  openReleaseBlockers: [],
};

function base(overrides: Partial<GoldenChainDerivationInput> = {}): GoldenChainDerivationInput {
  return {
    readinessInput: readyInput,
    financeInput: financeReady,
    completionInput: completionReady,
    finalizationInput: finalizationReady,
    stockInput: null,
    reservations: [],
    dispatchLineage: [],
    consumptionFinalizedReservationIds: [],
    readinessEvidenceSlices: verifiedEvidence,
    scanSlice: verifiedScan,
    dispatchEvidencePrepared: true,
    financeCommerciallyReleased: true,
    completionAttested: true,
    ...overrides,
  };
}

function minimalState(
  partial: Pick<GoldenChainOrderState, "stage" | "orderStatus" | "dispatchAlreadyFinalized"> &
    Partial<GoldenChainOrderState>,
): GoldenChainOrderState {
  return {
    orderId,
    orderNumber: "SO-2026-000119",
    orderStatus: partial.orderStatus ?? "cleared_for_dispatch",
    paymentStatus: "verified_advance",
    companyName: "Pilot Co",
    orderLines: [],
    staffStageLabel: "",
    requiredRole: "dispatch",
    whoMustActNext: "",
    readinessInput: readyInput,
    financeInput: financeReady,
    completionInput: completionReady,
    finalizationInput: finalizationReady,
    stockInput: null,
    reservations: [],
    dispatchLineage: [],
    consumptionFinalizedReservationIds: [],
    readinessEvidenceSlices: verifiedEvidence,
    scanSlice: verifiedScan,
    dispatchEvidencePrepared: true,
    stage: partial.stage,
    cta: "Finalize dispatch",
    blockers: [],
    evidenceRefs: {
      packingPhotoRef: "",
      documentPlaceholderRef: "",
      gateScanRef: "",
      transporterRef: "",
      stockFinalizeReason: "",
      overrideReason: "",
    },
    dispatchAlreadyFinalized: partial.dispatchAlreadyFinalized ?? false,
    stockConsumptionComplete: false,
    ...partial,
  } as GoldenChainOrderState;
}

describe("golden chain dispatch finalize advance", () => {
  it("derives Reserve stock after dispatch finalized with lineage and no reservation", () => {
    const result = deriveGoldenChainStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        dispatchLineage: [
          { releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() },
        ],
      }),
    );
    expect(result.stage).toBe("reservation");
    expect(result.cta).toBe("Reserve stock");
    expect(result.dispatchAlreadyFinalized).toBe(true);
  });

  it("detects advance past finalize for UI reload helper", () => {
    const prev = minimalState({ stage: "dispatch_finalization", orderStatus: "cleared_for_dispatch" });
    const next = minimalState({
      stage: "reservation",
      orderStatus: "dispatched",
      dispatchAlreadyFinalized: true,
      cta: "Reserve stock",
    });
    expect(goldenChainAdvancedPastDispatchFinalize(prev, next)).toBe(true);
    expect(goldenChainPastDispatchFinalize(next)).toBe(true);
  });

  it("duplicate finalize lineage keeps operator on Reserve stock, not Finalize dispatch", () => {
    const result = deriveGoldenChainStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        dispatchLineage: [
          { releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() },
        ],
      }),
    );
    expect(result.stage).not.toBe("dispatch_finalization");
    expect(result.cta).not.toBe("Finalize dispatch");
  });
});
