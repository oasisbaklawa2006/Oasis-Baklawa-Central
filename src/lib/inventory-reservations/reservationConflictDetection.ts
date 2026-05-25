import type { InventoryReservationRecord } from "./reservationTypes";
import { isReservationOpen } from "./reservationLifecycle";

export type ReservationConflictKind =
  | "competing_reservation"
  | "insufficient_inventory"
  | "expired_allocation"
  | "blocked_inventory_source"
  | "stale_version";

export interface ReservationConflict {
  kind: ReservationConflictKind;
  message: string;
  reservationId?: string;
  sku?: string;
}

export function detectCompetingReservations(
  sku: string,
  orderId: string,
  peers: InventoryReservationRecord[],
  excludeId?: string,
): ReservationConflict | null {
  const open = peers.filter(
    (r) =>
      r.sku === sku &&
      r.orderId !== orderId &&
      isReservationOpen(r.reservationStatus) &&
      r.id !== excludeId,
  );
  if (open.length === 0) return null;
  return {
    kind: "competing_reservation",
    message: `${open.length} competing open reservation(s) for SKU ${sku}`,
    sku,
    reservationId: open[0]?.id,
  };
}

export function detectExpiredReservation(reservation: InventoryReservationRecord, nowIso: string): ReservationConflict | null {
  if (!reservation.expiresAt) return null;
  if (reservation.expiresAt > nowIso) return null;
  if (!isReservationOpen(reservation.reservationStatus)) return null;
  return {
    kind: "expired_allocation",
    message: `Reservation ${reservation.reservationNumber} expired`,
    reservationId: reservation.id,
    sku: reservation.sku,
  };
}

export function mergeConflicts(...lists: Array<ReservationConflict | null>): ReservationConflict[] {
  return lists.filter((c): c is ReservationConflict => c !== null);
}
