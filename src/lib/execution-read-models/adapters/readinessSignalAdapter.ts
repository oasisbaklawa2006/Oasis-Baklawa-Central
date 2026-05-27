import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type {
  DispatchReadinessInput,
  DispatchExceptionType,
  ReservationReadinessStatus,
} from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import { deriveSignalMeta, downgradeIfStale } from "../signalStale";
import type { DerivedSignalMeta } from "../types";

export interface ReadinessScanSlice {
  hasUnresolvedMismatch: boolean;
  hasRejectedGateScan: boolean;
  gateScanVerified: boolean;
  cartonBarcodeVerified: boolean;
  latestAt: string | null;
}

export interface ReadinessEvidenceSlice {
  evidenceType: string;
  evidenceStatus: string;
  createdAt: string;
}

export interface ReadinessSignalFusion {
  input: DispatchReadinessInput;
  financeSignal: FinanceDispatchSignal;
  signalMeta: DerivedSignalMeta;
  missingSignals: string[];
}

export function deriveReadinessInputFromSlices(params: {
  orderId: string;
  reservationStatus: ReservationReadinessStatus;
  financeSignal: FinanceDispatchSignal;
  financeMeta: DerivedSignalMeta;
  scan: ReadinessScanSlice;
  evidence: ReadinessEvidenceSlice[];
  queueActive?: boolean;
}): ReadinessSignalFusion {
  const missingSignals: string[] = [];
  const scanMeta = deriveSignalMeta(params.scan.latestAt);
  const signalMeta = params.financeMeta.stale || scanMeta.stale ? deriveSignalMeta(null) : scanMeta;

  let financeSignal = params.financeSignal;
  if (params.financeSignal === "unknown") {
    financeSignal = "pending_review";
    missingSignals.push("finance_signal_unknown");
  }
  financeSignal = downgradeIfStale(financeSignal, params.financeMeta, "ready", "blocked", "pending_review");

  const packingEvidenceVerified = params.evidence.some(
    (e) => e.evidenceType === "packing_photo" && e.evidenceStatus === "verified",
  );
  const documentPlaceholderPresent = params.evidence.some((e) => e.evidenceType === "document_placeholder");

  const openExceptionTypes: DispatchExceptionType[] = [];
  if (params.scan.hasUnresolvedMismatch) {
    openExceptionTypes.push("dispatch_barcode_mismatch");
  }
  if (params.scan.hasRejectedGateScan) {
    openExceptionTypes.push("dispatch_gate_rejected");
  }
  if (financeSignal === "blocked") {
    openExceptionTypes.push("dispatch_finance_signal_blocked");
  }

  if (params.scan.hasUnresolvedMismatch) missingSignals.push("scan_mismatch_unresolved");
  if (params.scan.hasRejectedGateScan) missingSignals.push("gate_scan_rejected");

  const input: DispatchReadinessInput = {
    orderId: params.orderId,
    queue: {
      queueItemId: null,
      isActive: params.queueActive ?? true,
      isCompleted: false,
      hasVersionConflict: false,
    },
    scan: {
      hasUnresolvedMismatch: params.scan.hasUnresolvedMismatch,
      hasRejectedGateScan: params.scan.hasRejectedGateScan,
      gateScanVerified: params.scan.gateScanVerified,
      cartonBarcodeVerified: params.scan.cartonBarcodeVerified,
    },
    reservationStatus: params.reservationStatus,
    financeSignal,
    packingEvidenceVerified,
    documentPlaceholderPresent,
    openExceptionTypes,
  };

  return { input, financeSignal, signalMeta, missingSignals };
}
