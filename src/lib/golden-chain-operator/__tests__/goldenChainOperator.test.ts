import { describe, expect, it } from "vitest";
import { deriveFinalizationInputFromSlices } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";
import { projectDispatchRelease } from "@/lib/dispatch-finalization/dispatchFinalizationProjection";
import {
  dispatchFinalizeGuardMessage,
  hasGovernedDispatchFinalizeLineage,
} from "../goldenChainDuplicateGuards";
import { buildGoldenChainEvidenceRefs } from "../goldenChainEvidenceRefs";
import {
  deriveGoldenChainStage,
  governanceStageLabel,
  type GoldenChainDerivationInput,
} from "../goldenChainStageDerivation";
import {
  filterActiveReservationsForStock,
  isReservationFullyFulfilledOnRow,
  orderHasStockConsumptionFinalized,
  shouldShowOrderAsStockFinalizationCandidate,
} from "../goldenChainStockFilters";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

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

function baseDerivation(overrides: Partial<GoldenChainDerivationInput> = {}): GoldenChainDerivationInput {
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

describe("golden chain operator", () => {
  it("derives 4B when readiness not gate eligible", () => {
    const notReady: DispatchReadinessInput = {
      ...readyInput,
      packingEvidenceVerified: false,
      documentPlaceholderPresent: false,
    };
    const result = deriveGoldenChainStage(baseDerivation({ readinessInput: notReady }));
    expect(result.stage).toBe("4b_readiness");
    expect(result.cta).toBe("Complete readiness");
  });

  it("derives next-action sequence through 4C and 4D", () => {
    const financePending: FinanceGovernanceInput = {
      ...financeReady,
      creditApproved: false,
      openHoldTypes: ["credit_limit_exceeded"],
    };
    expect(deriveGoldenChainStage(baseDerivation({ financeInput: financePending })).stage).toBe("4c_finance");

    const completionPending: DispatchCompletionInput = {
      ...completionReady,
      securityGatePassed: false,
    };
    expect(deriveGoldenChainStage(baseDerivation({ completionInput: completionPending })).stage).toBe(
      "4d_completion",
    );
  });

  it("blocks duplicate dispatch finalization when lineage has finalize", () => {
    const lineage = [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }];
    expect(hasGovernedDispatchFinalizeLineage(lineage)).toBe(true);
    expect(dispatchFinalizeGuardMessage(lineage)).toMatch(/Dispatch was already finalized/);

    const fusion = deriveFinalizationInputFromSlices({
      orderId,
      currentOrderStatus: "cleared_for_dispatch",
      readinessStatus: "gate_eligible",
      financeSignal: "ready",
      financeReleaseStatus: "commercially_released",
      completionStatus: "completion_attested",
      reservationReady: true,
      transporterReference: "T-1",
      gateReference: "G-1",
      completionReference: "C-1",
      lineage,
      financeBlocked: false,
      scanBlocked: false,
    });
    const projection = projectDispatchRelease(fusion.input);
    expect(projection.canFinalize).toBe(false);
    expect(fusion.input.openReleaseBlockers).toContain("dispatch_already_finalized");
  });

  it("hides stock-finalized orders and fulfilled reservations from candidates", () => {
    const fulfilledRow: StockReservationRecord = {
      ...reservation,
      fulfilledQty: 10,
      reservedQty: 0,
    };
    expect(isReservationFullyFulfilledOnRow(fulfilledRow)).toBe(true);
    expect(filterActiveReservationsForStock([fulfilledRow])).toHaveLength(0);

    expect(
      orderHasStockConsumptionFinalized(
        [{ reservationId: reservation.id, lineageType: "consumption_finalized" }],
        [reservation],
      ),
    ).toBe(true);

    expect(
      shouldShowOrderAsStockFinalizationCandidate({
        orderStatus: "dispatched",
        dispatchFinalized: true,
        lineage: [{ reservationId: reservation.id, lineageType: "consumption_finalized" }],
        reservations: [reservation],
      }),
    ).toBe(false);
  });

  it("advances to 4G after dispatch and reservation", () => {
    const dispatched: DispatchFinalizationInput = {
      ...finalizationReady,
      currentOrderStatus: "dispatched",
    };
    const result = deriveGoldenChainStage(
      baseDerivation({
        finalizationInput: dispatched,
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
    expect(result.stage).toBe("4g_stock");
    expect(result.cta).toBe("Finalize stock consumption");
  });

  it("marks complete when stock consumption finalized", () => {
    const result = deriveGoldenChainStage(
      baseDerivation({
        finalizationInput: { ...finalizationReady, currentOrderStatus: "dispatched" },
        completionInput: { ...completionReady, orderAlreadyDispatched: true },
        reservations: [reservation],
        consumptionFinalizedReservationIds: [reservation.id],
        dispatchLineage: [{ releaseType: "finalize", nextStatus: "dispatched", createdAt: new Date().toISOString() }],
      }),
    );
    expect(result.stage).toBe("complete");
    expect(result.cta).toBe("Already complete");
    expect(governanceStageLabel("complete")).toBe("Done");
  });

  it("auto-generates evidence references from order id", () => {
    const refs = buildGoldenChainEvidenceRefs(orderId, "SO-2026-000142");
    expect(refs.packingPhotoRef).toBe("PACKING-SO-2026-000142");
    expect(refs.documentPlaceholderRef).toBe("DOC-SLOT-SO-2026-000142");
    expect(refs.gateScanRef).toBe("GATE-SO-2026-000142");
    expect(refs.transporterRef).toBe("HANDOFF-SO-2026-000142");
    expect(refs.stockFinalizeReason).toBe("AUTO-4G-SO-2026-000142");
  });
});
