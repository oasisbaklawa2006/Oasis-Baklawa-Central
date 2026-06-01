import { isFinanceSignalBlocking, isFinanceSignalReady } from "./financeDispatchSignal";
import type {
  DispatchReadinessDimension,
  DispatchReadinessInput,
  ReservationReadinessStatus,
} from "./dispatchReadinessTypes";

export interface DimensionRuleResult {
  dimension: DispatchReadinessDimension;
  satisfied: boolean;
  missingLabel?: string;
  warning?: string;
}

const RESERVATION_READY_STATUSES: ReservationReadinessStatus[] = [
  "reserved",
  "fulfilled",
  "partially_reserved",
];

export function evaluateQueueReady(input: DispatchReadinessInput): DimensionRuleResult {
  const { queue } = input;
  if (queue.hasVersionConflict) {
    return {
      dimension: "queue_ready",
      satisfied: false,
      missingLabel: "Dispatch queue version conflict — reconcile before review",
    };
  }
  if (!queue.isActive && !queue.isCompleted) {
    return {
      dimension: "queue_ready",
      satisfied: false,
      missingLabel: "No active dispatch queue item for order",
    };
  }
  if (queue.isCompleted) {
    return {
      dimension: "queue_ready",
      satisfied: true,
      warning: "Queue item completed — verify downstream gate policy",
    };
  }
  return { dimension: "queue_ready", satisfied: true };
}

export function evaluatePackingEvidence(input: DispatchReadinessInput): DimensionRuleResult {
  if (!input.packingEvidenceVerified) {
    return {
      dimension: "packing_evidence_ready",
      satisfied: false,
      missingLabel: "Verified packing photo evidence required",
    };
  }
  return { dimension: "packing_evidence_ready", satisfied: true };
}

export function evaluateBarcodeVerified(input: DispatchReadinessInput): DimensionRuleResult {
  const { scan } = input;
  if (scan.hasUnresolvedMismatch) {
    return {
      dimension: "barcode_verified",
      satisfied: false,
      missingLabel: "Unresolved barcode mismatch on dispatch lane",
    };
  }
  if (!scan.cartonBarcodeVerified) {
    return {
      dimension: "barcode_verified",
      satisfied: false,
      missingLabel: "Carton barcode not verified",
    };
  }
  return { dimension: "barcode_verified", satisfied: true };
}

export function evaluateReservationReady(input: DispatchReadinessInput): DimensionRuleResult {
  const status = input.reservationStatus;
  if (status === "blocked" || status === "pending" || status === "none") {
    return {
      dimension: "reservation_ready",
      satisfied: false,
      missingLabel: `Reservation not ready (status: ${status})`,
    };
  }
  if (!RESERVATION_READY_STATUSES.includes(status)) {
    return {
      dimension: "reservation_ready",
      satisfied: false,
      missingLabel: `Reservation status ${status} does not satisfy dispatch policy`,
    };
  }
  return { dimension: "reservation_ready", satisfied: true };
}

export function evaluateFinanceSignal(input: DispatchReadinessInput): DimensionRuleResult {
  if (isFinanceSignalBlocking(input.financeSignal)) {
    return {
      dimension: "finance_signal_ready",
      satisfied: false,
      missingLabel: "Finance dispatch signal blocked (read-only placeholder)",
    };
  }
  if (!isFinanceSignalReady(input.financeSignal)) {
    return {
      dimension: "finance_signal_ready",
      satisfied: false,
      missingLabel: `Finance signal not ready: ${input.financeSignal}`,
    };
  }
  return { dimension: "finance_signal_ready", satisfied: true };
}

export function evaluateGateScan(input: DispatchReadinessInput): DimensionRuleResult {
  if (input.scan.hasRejectedGateScan) {
    return {
      dimension: "gate_scan_ready",
      satisfied: false,
      missingLabel: "Gate scan rejected — security review required",
    };
  }
  if (!input.scan.gateScanVerified) {
    return {
      dimension: "gate_scan_ready",
      satisfied: false,
      missingLabel: "Verified gate scan required",
    };
  }
  return { dimension: "gate_scan_ready", satisfied: true };
}

export function evaluateDocumentPlaceholder(input: DispatchReadinessInput): DimensionRuleResult {
  if (!input.documentPlaceholderPresent) {
    return {
      dimension: "document_placeholder_ready",
      satisfied: false,
      missingLabel: "Document placeholder (e-way/invoice slot) not recorded",
    };
  }
  return { dimension: "document_placeholder_ready", satisfied: true };
}

export function evaluateExceptionClear(input: DispatchReadinessInput): DimensionRuleResult {
  if (input.openExceptionTypes.length > 0) {
    return {
      dimension: "exception_clear",
      satisfied: false,
      missingLabel: `${input.openExceptionTypes.length} open dispatch exception(s)`,
    };
  }
  return { dimension: "exception_clear", satisfied: true };
}

export function evaluateAllDimensions(input: DispatchReadinessInput): DimensionRuleResult[] {
  const skipReservation = input.readinessPolicy === "pre_dispatch";
  return [
    evaluateQueueReady(input),
    evaluatePackingEvidence(input),
    evaluateBarcodeVerified(input),
    ...(skipReservation ? [] : [evaluateReservationReady(input)]),
    evaluateFinanceSignal(input),
    evaluateGateScan(input),
    evaluateDocumentPlaceholder(input),
    evaluateExceptionClear(input),
  ];
}
