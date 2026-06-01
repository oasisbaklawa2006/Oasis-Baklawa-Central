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

const readyInput: DispatchReadinessInput = {
  orderId,
  queue: { queueItemId: null, isActive: true, isCompleted: false, hasVersionConflict: false },
  scan: {
    hasUnresolvedMismatch: false,
    hasRejectedGateScan: false,
    gateScanVerified: true,
    cartonBarcodeVerified: true,
  },
  reservationStatus: "reserved",
  financeSignal: "ready",
  packingEvidenceVerified: true,
  documentPlaceholderPresent: true,
  openExceptionTypes: [],
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
    ...overrides,
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
  it("needs_readiness when packing not verified", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        readinessInput: {
          ...readyInput,
          packingEvidenceVerified: false,
          documentPlaceholderPresent: false,
        },
      }),
    );
    expect(r.currentStage).toBe("needs_readiness");
    expect(r.nextAction).toBe("Complete readiness");
    expect(r.requiredRole).toBe("dispatch");
  });

  it("needs_finance_release when commercial release pending", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        financeInput: { ...financeReady, creditApproved: false, openHoldTypes: ["credit_limit_exceeded"] },
      }),
    );
    expect(r.currentStage).toBe("needs_finance_release");
    expect(r.requiredRole).toBe("finance");
  });

  it("needs completion attestation before dispatch finalize on fresh chain", () => {
    const r = deriveGoldenChainStaffStage(base());
    expect(r.currentStage).toBe("needs_completion_attestation");
    expect(r.nextAction).toBe("Complete completion attestation");
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
    expect(["needs_reservation", "needs_stock_finalization", "complete", "inconsistent_state"]).toContain(
      r.currentStage,
    );
  });

  it("needs_stock_finalization after dispatch and reservation", () => {
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
    expect(r.currentStage).toBe("needs_stock_finalization");
    expect(r.nextAction).toBe("Finalize stock consumption");
  });

  it("complete when consumption finalized", () => {
    const r = deriveGoldenChainStaffStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        reservations: [reservation],
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
