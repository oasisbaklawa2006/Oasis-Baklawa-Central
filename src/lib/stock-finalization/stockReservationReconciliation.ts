import type { StockReservationRecord } from "./stockReservationTypes";
import { deriveConsumableQty, reservationConsumableForStock } from "./stockDeductionEligibility";

export type ReconciliationStatus = "aligned" | "partial" | "blocked" | "variance";

export interface ReservationReconciliationResult {
  reconciliationStatus: ReconciliationStatus;
  consumedQty: number;
  varianceQty: number;
  unresolvedReservationQty: number;
  warnings: string[];
  blockers: string[];
  lineItems: {
    reservationId: string;
    productId: string;
    sku: string;
    consumableQty: number;
    reservedQty: number;
    fulfilledQty: number;
    releasedQty: number;
  }[];
}

export function reconcileReservationsForConsumption(
  reservations: StockReservationRecord[],
  alreadyFinalizedIds: string[] = [],
): ReservationReconciliationResult {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const lineItems: ReservationReconciliationResult["lineItems"] = [];

  let consumedQty = 0;
  let unresolvedReservationQty = 0;

  for (const r of reservations) {
    if (alreadyFinalizedIds.includes(r.id)) continue;

    const consumableQty = reservationConsumableForStock(r) ? deriveConsumableQty(r) : 0;
    const unresolved =
      r.requestedQty - r.reservedQty - r.fulfilledQty - r.releasedQty;

    if (unresolved > 0.0001) {
      unresolvedReservationQty += unresolved;
      warnings.push(`reservation_${r.id}_unresolved_qty_${unresolved}`);
    }

    if (r.releasedQty > 0 && consumableQty === 0) {
      warnings.push(`reservation_${r.id}_released_without_consumption`);
    }

    if (consumableQty > 0) {
      lineItems.push({
        reservationId: r.id,
        productId: r.productId,
        sku: r.sku,
        consumableQty,
        reservedQty: r.reservedQty,
        fulfilledQty: r.fulfilledQty,
        releasedQty: r.releasedQty,
      });
      consumedQty += consumableQty;
    } else if (r.reservationStatus === "pending" || r.reservationStatus === "blocked") {
      blockers.push(`reservation_${r.id}_not_ready`);
    }
  }

  const varianceQty = Math.max(0, unresolvedReservationQty);

  let reconciliationStatus: ReconciliationStatus = "aligned";
  if (blockers.length > 0) reconciliationStatus = "blocked";
  else if (varianceQty > 0) reconciliationStatus = "variance";
  else if (lineItems.length === 0) reconciliationStatus = "blocked";
  else if (warnings.length > 0) reconciliationStatus = "partial";

  return {
    reconciliationStatus,
    consumedQty,
    varianceQty,
    unresolvedReservationQty,
    warnings,
    blockers,
    lineItems,
  };
}
