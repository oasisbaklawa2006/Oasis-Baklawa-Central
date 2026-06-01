import { describe, expect, it } from "vitest";
import { projectDispatchReadiness } from "@/lib/dispatch-readiness/dispatchReadinessProjection";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import { prepareDispatchEvidenceForOrder } from "../goldenChainPrepareDispatchEvidence";
import { isDispatchEvidencePrepared } from "../goldenChainPrerequisites";
import {
  deriveGoldenChainStage,
  type GoldenChainDerivationInput,
} from "../goldenChainStageDerivation";

const orderId = "b12e0115-1203-47d8-991d-e419812b0001";

const verifiedEvidence = [
  { evidenceType: "packing_photo", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "document_placeholder", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
  { evidenceType: "gate_scan", evidenceStatus: "verified", createdAt: "2026-01-01T00:00:00Z" },
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
  const dispatchEvidencePrepared =
    overrides.dispatchEvidencePrepared ??
    isDispatchEvidencePrepared(
      overrides.readinessEvidenceSlices ?? verifiedEvidence,
      overrides.scanSlice ?? verifiedScan,
    );
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
    dispatchEvidencePrepared,
    financeCommerciallyReleased:
      overrides.financeCommerciallyReleased ??
      projectFinanceRelease(overrides.financeInput ?? financeReady).releaseStatus ===
        "commercially_released",
    ...overrides,
  };
}

describe("golden chain stage order (24D)", () => {
  it("cleared order without evidence starts at prepare_dispatch_evidence", () => {
    const result = deriveGoldenChainStage(
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
        readinessInput: {
          ...readyInput,
          packingEvidenceVerified: false,
          documentPlaceholderPresent: false,
        },
      }),
    );
    expect(result.stage).toBe("prepare_dispatch_evidence");
    expect(result.cta).toBe("Prepare dispatch evidence");
  });

  it("routes to finance_release before readiness when commercial release missing", () => {
    const result = deriveGoldenChainStage(
      base({
        financeInput: { ...financeReady, creditApproved: false, openHoldTypes: ["credit_limit_exceeded"] },
        financeCommerciallyReleased: false,
      }),
    );
    expect(result.stage).toBe("finance_release");
    expect(result.cta).toBe("Complete finance release");
  });

  it("readiness_review only after evidence and finance; pre_dispatch skips reservation", () => {
    const noFinanceSignal: DispatchReadinessInput = {
      ...readyInput,
      financeSignal: "pending_review",
      openExceptionTypes: ["dispatch_finance_signal_blocked"],
    };
    const projection = projectDispatchReadiness(noFinanceSignal);
    expect(projection.readinessStatus).not.toBe("gate_eligible");

    const withReservationNone = projectDispatchReadiness({
      ...readyInput,
      reservationStatus: "none",
      readinessPolicy: "pre_dispatch",
    });
    expect(withReservationNone.readinessStatus).toBe("gate_eligible");

    const blocked = deriveGoldenChainStage(
      base({
        readinessInput: noFinanceSignal,
      }),
    );
    expect(blocked.stage).toBe("readiness_review");
  });

  it("reaches dispatch_finalization after completion when gate eligible", () => {
    const result = deriveGoldenChainStage(base());
    expect(result.stage).toBe("completion_attestation");
    expect(result.cta).toBe("Attest completion");
  });

  it("does not duplicate evidence when prepare is called with existing verified rows", async () => {
    const added: string[] = [];
    const mockService = {
      addEvidence: async (row: { evidenceType: string }) => {
        added.push(row.evidenceType);
        return { evidence: { id: "1" }, eventId: "e1" };
      },
    };
    const result = await prepareDispatchEvidenceForOrder(
      {} as never,
      {
        orderId,
        evidenceSlices: verifiedEvidence,
        scan: verifiedScan,
        refs: {
          packingPhotoRef: "P1",
          documentPlaceholderRef: "D1",
          gateScanRef: "GATE-SO-1",
          transporterRef: "T1",
          stockFinalizeReason: "R1",
          overrideReason: "",
        },
        readinessBundle: {
          service: mockService as never,
          canExecuteWrites: true,
          persistenceMode: "supabase",
        },
        ctx: {
          correlationId: "c1",
          actorUserId: "u1",
          actorRole: "DISPATCH_HEAD",
        },
      },
    );
    expect(added).toHaveLength(0);
    expect(result.skipped).toContain("packing_photo");
    expect(result.skipped).toContain("operational_dispatch_gate");
  });

  it("complete after stock consumption finalized", () => {
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
    const result = deriveGoldenChainStage(
      base({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        reservations: [reservation],
        consumptionFinalizedReservationIds: [reservation.id],
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
        financeCommerciallyReleased: true,
      }),
    );
    expect(result.stage).toBe("complete");
  });
});
