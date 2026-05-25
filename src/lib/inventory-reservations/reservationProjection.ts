import type { InventoryReservationRecord, ReservationStatus } from "./reservationTypes";
import { isReservationOpen } from "./reservationLifecycle";
import { detectExpiredReservation, detectCompetingReservations } from "./reservationConflictDetection";

export type BoardReservationIndicator =
  | "none"
  | "reserved"
  | "partial"
  | "blocked"
  | "shortage"
  | "expired";

export function projectBoardReservationIndicator(
  orderId: string | null,
  reservations: InventoryReservationRecord[],
  nowIso: string,
): BoardReservationIndicator {
  if (!orderId) return "none";
  const forOrder = reservations.filter((r) => r.orderId === orderId);
  if (!forOrder.length) return "none";

  if (forOrder.some((r) => detectExpiredReservation(r, nowIso))) return "expired";
  if (forOrder.some((r) => r.reservationStatus === "blocked")) return "blocked";
  if (forOrder.some((r) => r.reservationStatus === "pending" && r.reservedQty === 0)) return "shortage";
  if (forOrder.some((r) => r.reservationStatus === "partially_reserved")) return "partial";
  if (forOrder.some((r) => r.reservationStatus === "reserved")) return "reserved";
  if (forOrder.some((r) => isReservationOpen(r.reservationStatus))) return "partial";
  return "none";
}

export function projectReservationAuditSummary(reservation: InventoryReservationRecord) {
  return {
    reservationNumber: reservation.reservationNumber,
    status: reservation.reservationStatus,
    sku: reservation.sku,
    requestedQty: reservation.requestedQty,
    reservedQty: reservation.reservedQty,
    open: isReservationOpen(reservation.reservationStatus),
    version: reservation.version,
  };
}

export function projectOpenReservedQtyBySku(
  reservations: InventoryReservationRecord[],
  sku: string,
): number {
  return reservations
    .filter((r) => r.sku === sku && isReservationOpen(r.reservationStatus))
    .reduce((n, r) => n + Math.max(0, r.reservedQty - r.releasedQty), 0);
}

export function projectReservationConflicts(
  reservation: InventoryReservationRecord,
  peers: InventoryReservationRecord[],
  nowIso: string,
) {
  return [
    detectExpiredReservation(reservation, nowIso),
    detectCompetingReservations(reservation.sku, reservation.orderId, peers, reservation.id),
  ].filter(Boolean);
}

export function reservationStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    pending: "Pending",
    reserved: "Reserved",
    partially_reserved: "Partial",
    blocked: "Blocked",
    released: "Released",
    expired: "Expired",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}
