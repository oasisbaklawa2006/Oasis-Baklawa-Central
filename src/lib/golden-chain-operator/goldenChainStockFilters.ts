import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";

export interface StockLineageConsumptionSlice {
  reservationId: string;
  lineageType: string;
}

/** Hide reservations fully fulfilled on the reservation row (not stock lineage). */
export function isReservationFullyFulfilledOnRow(reservation: StockReservationRecord): boolean {
  if (reservation.requestedQty <= 0) return false;
  return reservation.fulfilledQty >= reservation.requestedQty;
}

export function filterActiveReservationsForStock(
  reservations: StockReservationRecord[],
): StockReservationRecord[] {
  return reservations.filter((r) => !isReservationFullyFulfilledOnRow(r));
}

export function orderHasStockConsumptionFinalized(
  lineage: StockLineageConsumptionSlice[],
  reservations: StockReservationRecord[],
): boolean {
  const active = filterActiveReservationsForStock(reservations);
  if (active.length === 0) return false;
  const finalizedIds = new Set(
    lineage.filter((l) => l.lineageType === "consumption_finalized").map((l) => l.reservationId),
  );
  return active.every((r) => finalizedIds.has(r.id));
}

export function shouldShowOrderAsStockFinalizationCandidate(params: {
  orderStatus: string;
  dispatchFinalized: boolean;
  lineage: StockLineageConsumptionSlice[];
  reservations: StockReservationRecord[];
}): boolean {
  if (params.orderStatus !== "dispatched" || !params.dispatchFinalized) return false;
  if (orderHasStockConsumptionFinalized(params.lineage, params.reservations)) return false;
  const active = filterActiveReservationsForStock(params.reservations);
  return active.some((r) => r.reservedQty > 0 || r.fulfilledQty > 0);
}
