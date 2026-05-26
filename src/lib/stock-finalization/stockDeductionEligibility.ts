import type { DispatchReleaseStatus } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockReservationRecord } from "./stockReservationTypes";
import type { StockFinalizationInput } from "./stockFinalizationTypes";

const DISPATCH_FINALIZED_STATUSES: DispatchReleaseStatus[] = ["dispatch_finalized"];
const DISPATCHED_ORDER_STATUS = "dispatched";

export interface DeductionEligibilityResult {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
}

export function isDispatchFinalizedForStock(
  dispatchReleaseStatus: DispatchReleaseStatus,
  orderStatus: string,
): boolean {
  if (!DISPATCH_FINALIZED_STATUSES.includes(dispatchReleaseStatus)) return false;
  return orderStatus === DISPATCHED_ORDER_STATUS;
}

export function reservationConsumableForStock(reservation: StockReservationRecord): boolean {
  const consumableStatuses = ["reserved", "fulfilled", "partially_reserved"] as const;
  if (!consumableStatuses.includes(reservation.reservationStatus as (typeof consumableStatuses)[number])) {
    return false;
  }
  const consumableQty = reservation.fulfilledQty > 0
    ? reservation.fulfilledQty
    : reservation.reservedQty;
  return consumableQty > 0;
}

export function deriveConsumableQty(reservation: StockReservationRecord): number {
  if (reservation.fulfilledQty > 0) return reservation.fulfilledQty;
  return reservation.reservedQty;
}

export function evaluateStockDeductionEligibility(input: StockFinalizationInput): DeductionEligibilityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!isDispatchFinalizedForStock(input.dispatchReleaseStatus, input.orderStatus)) {
    blockers.push("dispatch_not_finalized");
    return { eligible: false, blockers, warnings };
  }

  if (!input.scanReference?.trim()) {
    blockers.push("scan_evidence_required");
  }

  if (!input.gateReference?.trim()) {
    warnings.push("gate_reference_missing");
  }

  if (input.reservations.length === 0) {
    blockers.push("no_reservations");
    return { eligible: false, blockers, warnings };
  }

  const consumable = input.reservations.filter(reservationConsumableForStock);
  if (consumable.length === 0) {
    blockers.push("no_consumable_reservation_qty");
  }

  for (const r of consumable) {
    const qty = deriveConsumableQty(r);
    if (qty <= 0) blockers.push(`reservation_${r.id}_zero_qty`);
    if (input.alreadyFinalizedReservationIds?.includes(r.id)) {
      blockers.push(`reservation_${r.id}_already_finalized`);
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}
