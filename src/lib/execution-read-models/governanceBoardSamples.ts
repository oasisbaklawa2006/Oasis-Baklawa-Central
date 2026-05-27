/**
 * Preview-only samples — never used unless VITE_EXECUTION_PREVIEW_FALLBACK=true.
 */
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

export const PREVIEW_FINANCE_INPUTS: FinanceGovernanceInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000201",
    orderValue: 120_000,
    advanceRequired: 40_000,
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
  },
  {
    orderId: "00000000-0000-4000-8000-000000000202",
    orderValue: 600_000,
    advanceRequired: 200_000,
    advanceVerified: false,
    creditApproved: false,
    openHoldTypes: ["advance_unverified"],
    reservationReady: false,
    dispatchReadinessGateEligible: false,
    complaintSeverity: "medium",
    staleFinanceReview: true,
    manualOverrideCount: 1,
    rejectionCount: 1,
    escalationCount: 2,
  },
];

export const PREVIEW_READINESS_INPUTS: DispatchReadinessInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000101",
    queue: { queueItemId: "q-1", isActive: true, isCompleted: false, hasVersionConflict: false },
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
  },
  {
    orderId: "00000000-0000-4000-8000-000000000102",
    queue: { queueItemId: "q-2", isActive: true, isCompleted: false, hasVersionConflict: false },
    scan: {
      hasUnresolvedMismatch: true,
      hasRejectedGateScan: false,
      gateScanVerified: false,
      cartonBarcodeVerified: false,
    },
    reservationStatus: "pending",
    financeSignal: "blocked",
    packingEvidenceVerified: false,
    documentPlaceholderPresent: false,
    openExceptionTypes: ["dispatch_barcode_mismatch"],
  },
];

export const PREVIEW_COMPLETION_INPUTS: DispatchCompletionInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000301",
    queueItemId: "q-d1",
    readinessStatus: "gate_eligible",
    financeSignal: "ready",
    financeReleaseStatus: "commercially_released",
    reservationReady: true,
    orderAlreadyDispatched: false,
    securityGatePassed: true,
    courierManifestAttached: true,
    openCompletionHolds: [],
  },
  {
    orderId: "00000000-0000-4000-8000-000000000302",
    queueItemId: "q-d2",
    readinessStatus: "partially_ready",
    financeSignal: "blocked",
    financeReleaseStatus: "finance_hold",
    reservationReady: false,
    orderAlreadyDispatched: false,
    securityGatePassed: false,
    courierManifestAttached: false,
    openCompletionHolds: ["supervisor_review_required"],
  },
];

export const PREVIEW_FINALIZATION_INPUTS: DispatchFinalizationInput[] = [
  {
    orderId: "00000000-0000-4000-8000-000000000501",
    currentOrderStatus: "cleared_for_dispatch",
    readinessStatus: "gate_eligible",
    financeSignal: "ready",
    financeReleaseStatus: "commercially_released",
    completionStatus: "completion_attested",
    reservationReady: true,
    transporterHandoffFinalized: true,
    gateReference: "gate-scan-501",
    completionReference: "attest-501",
    transporterReference: "Delhivery / AWB-501",
    openReleaseBlockers: [],
  },
  {
    orderId: "00000000-0000-4000-8000-000000000502",
    currentOrderStatus: "packed_ready",
    readinessStatus: "partially_ready",
    financeSignal: "blocked",
    financeReleaseStatus: "finance_hold",
    completionStatus: "prerequisites_pending",
    reservationReady: false,
    transporterHandoffFinalized: false,
    gateReference: null,
    completionReference: null,
    transporterReference: null,
    openReleaseBlockers: ["awaiting_supervisor"],
  },
];

export const PREVIEW_STOCK_RESERVATION: StockReservationRecord = {
  id: "00000000-0000-4000-8000-000000000801",
  reservationNumber: "RSV-4G-001",
  orderId: "00000000-0000-4000-8000-000000000601",
  productId: "00000000-0000-4000-8000-000000000701",
  sku: "BAK-4G-DEMO",
  requestedQty: 12,
  reservedQty: 12,
  fulfilledQty: 0,
  releasedQty: 0,
  reservationStatus: "reserved",
};

export const PREVIEW_STOCK_FINALIZED: StockFinalizationInput = {
  orderId: "00000000-0000-4000-8000-000000000601",
  orderStatus: "dispatched",
  dispatchReleaseStatus: "dispatch_finalized",
  reservations: [PREVIEW_STOCK_RESERVATION],
  scanReference: "PACK-SCAN-4G-001",
  gateReference: "GATE-4G-001",
  dispatchLineageId: "drl-4g-001",
  locationCode: "WH-MAIN",
};

export const PREVIEW_STOCK_PENDING: StockFinalizationInput = {
  ...PREVIEW_STOCK_FINALIZED,
  orderId: "00000000-0000-4000-8000-000000000602",
  orderStatus: "cleared_for_dispatch",
  dispatchReleaseStatus: "dispatch_release_ready",
  scanReference: null,
};
