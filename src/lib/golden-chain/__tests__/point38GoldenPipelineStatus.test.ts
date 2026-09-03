import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGoldenChainStaffStage } from "@/lib/golden-chain/deriveGoldenChainStage";
import type { GoldenChainDerivationInput } from "@/lib/golden-chain-operator/goldenChainStageDerivation";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const orderId = "point38-order-1";

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
  gateReference: "GATE-POINT38",
  completionReference: "COMP-POINT38",
  transporterReference: "TR-POINT38",
  openReleaseBlockers: [],
};

function baseDerivation(
  overrides: Partial<GoldenChainDerivationInput> = {},
): GoldenChainDerivationInput {
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
    completionAttested: false,
    ...overrides,
  };
}

describe("Point 38 — Golden Pipeline order status / governance-board closure", () => {
  it("Golden Chain Operator Wizard composes governance bundles without direct orders.update", () => {
    const wizard = source("src/pages/admin/GoldenChainOperatorWizard.tsx");
    for (const bundle of [
      "createDispatchReadinessBundle",
      "createFinanceGovernanceBundle",
      "createDispatchCompletionBundle",
      "createDispatchFinalizationBundle",
      "createStockFinalizationBundle",
    ]) {
      expect(wizard, `wizard must compose ${bundle}`).toContain(bundle);
    }
    expect(wizard).not.toContain('.from("orders").update');
    expect(wizard).toContain("prepareDispatchEvidenceForOrder");
    expect(wizard).toContain("finalizeDispatch");
  });

  it("Order Management STATUS_FLOW exposes the canonical golden pipeline statuses", () => {
    const page = source("src/pages/admin/OrderManagement.tsx");
    for (const status of [
      "submitted",
      "confirmed",
      "in_production",
      "packed_ready",
      "awaiting_final_payment",
      "cleared_for_dispatch",
      "dispatched",
      "delivered",
    ]) {
      expect(page, `golden pipeline status ${status} must be in STATUS_FLOW`).toContain(`"${status}"`);
    }
    expect(page).toContain("Governed Finalize");
    expect(page).toContain("Mark Dispatched is disabled here");
  });

  it("golden chain stage derivation starts at prepare_dispatch_evidence when evidence is missing", () => {
    const result = deriveGoldenChainStaffStage(
      baseDerivation({
        dispatchEvidencePrepared: false,
        readinessEvidenceSlices: [],
        scanSlice: {
          hasUnresolvedMismatch: false,
          hasRejectedGateScan: false,
          gateScanVerified: false,
          cartonBarcodeVerified: false,
          latestAt: null,
        },
        financeCommerciallyReleased: false,
      }),
    );
    expect(result.currentStage).toBe("prepare_dispatch_evidence");
    expect(result.nextAction).toBe("Prepare dispatch evidence");
  });

  it("golden chain stage advances to reservation after governed dispatch finalization lineage", () => {
    const result = deriveGoldenChainStaffStage(
      baseDerivation({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: "2026-01-02T00:00:00Z" }],
        reservations: [
          {
            id: "res-point38",
            reservationNumber: "RES-POINT38",
            orderId,
            productId: "prod-1",
            sku: "SKU-1",
            requestedQty: 4,
            reservedQty: 4,
            fulfilledQty: 0,
            releasedQty: 0,
            reservationStatus: "reserved",
          },
        ],
      }),
    );
    expect(result.dispatchAlreadyFinalized).toBe(true);
    expect(["reservation", "stock_finalization", "complete"]).toContain(result.currentStage);
  });

  it("golden chain order queries include cleared_for_dispatch pipeline status", () => {
    const queries = source("src/lib/golden-chain-operator/goldenChainOrderQueries.ts");
    expect(queries).toContain('"cleared_for_dispatch"');
    expect(queries).toContain("loadGoldenChainOrderState");
  });
});
