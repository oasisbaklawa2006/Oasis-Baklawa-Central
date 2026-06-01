import { describe, expect, it } from "vitest";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import {
  deriveGoldenChainStaffStage,
  type GoldenChainDerivationInput,
} from "../deriveGoldenChainStage";

const orderId = "b12e0115-1203-47d8-991d-e419812b0001";

const verifiedEvidence = [
  { evidenceType: "packing_photo", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "document_placeholder", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "gate_scan", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "manual_readiness_review", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
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
  reservationReady: true,
  orderAlreadyDispatched: false,
  securityGatePassed: true,
  courierManifestAttached: true,
  openCompletionHolds: [],
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
    ...overrides,
    completionAttested: overrides.completionAttested ?? false,
  };
}

const reservation: StockReservationRecord = {
  id: "res-1",
  reservationNumber: "RES-1",
  orderId,
  productId: "prod-1",
  sku: "SKU-1",
  requestedQty: 10,
  reservedQty: 10,
  fulfilledQty: 0,
  releasedQty: 0,
  reservationStatus: "reserved",
};

describe("deriveGoldenChainStaffStage", () => {
  it("prepare_dispatch_evidence when packing not verified", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        dispatchEvidencePrepared: false,
        readinessEvidenceSlices: [],
        scanSlice: {
          hasUnresolvedMismatch: false,
          hasRejectedGateScan: false,
          gateScanVerified: false,
          cartonBarcodeVerified: false,
          latestAt: null,
        },
      }),
    );
    expect(r.currentStage).toBe("prepare_dispatch_evidence");
    expect(r.nextAction).toBe("Prepare dispatch evidence");
    expect(r.requiredRole).toBe("dispatch");
  });

  it("finance_release when commercial release pending", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        financeInput: { ...financeReady, creditApproved: false, openHoldTypes: ["credit_limit_exceeded"] },
        financeCommerciallyReleased: false,
      }),
    );
    expect(r.currentStage).toBe("finance_release");
    expect(r.requiredRole).toBe("finance");
  });

  it("needs completion attestation before dispatch finalize on fresh chain", () => {
    const r = deriveGoldenChainStaffStage(base());
    expect(r.currentStage).toBe("completion_attestation");
    expect(r.nextAction).toBe("Attest completion");
  });

  it("detects finalize lineage and advances past dispatch finalize", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        reservations: [reservation],
      }),
    );
    expect(r.dispatchAlreadyFinalized).toBe(true);
    expect(["reservation", "stock_finalization", "complete", "inconsistent_state"]).toContain(
      r.currentStage,
    );
  });

  it("stock_finalization after dispatch and reservation", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        reservations: [reservation],
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
        stockInput: {
          orderId,
          orderStatus: "dispatched",
          dispatchReleaseStatus: "dispatch_finalized",
          reservations: [reservation],
          scanReference: "SCAN-1",
          gateReference: "GATE-1",
          dispatchLineageId: "lineage-1",
          locationCode: "WH-MAIN",
          alreadyFinalizedReservationIds: [],
        },
      }),
    );
    expect(r.currentStage).toBe("stock_finalization");
    expect(r.nextAction).toBe("Finalize stock");
  });

  it("complete when consumption finalized", () => {
    const consumedReservation: StockReservationRecord = {
      ...reservation,
      fulfilledQty: reservation.requestedQty,
      reservedQty: 0,
      reservationStatus: "fulfilled",
    };
    const r = deriveGoldenChainStaffStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        completionAttested: true,
        reservations: [consumedReservation],
        consumptionFinalizedReservationIds: [reservation.id],
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
      }),
    );
    expect(r.currentStage).toBe("complete");
    expect(r.isComplete).toBe(true);
    expect(r.nextAction).toBe("Already complete");
  });

  it("inconsistent_state when finalize lineage but order not dispatched", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
        finalizationInput: { ...finalizationReady, currentOrderStatus: "cleared_for_dispatch" },
      }),
    );
    expect(r.currentStage).toBe("inconsistent_state");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
