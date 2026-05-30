import type { ReservationReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";

const RESERVATION_READY_STATUSES = new Set<ReservationReadinessStatus>([
  "reserved",
  "fulfilled",
  "partially_reserved",
]);

/**
 * Derives dispatch-governance reservation readiness from inventory_reservations rows.
 */
export function deriveReservationReadinessForOrder(
  reservationStatuses: string[],
): { reservationStatus: ReservationReadinessStatus; reservationReady: boolean } {
  if (reservationStatuses.length === 0) {
    return { reservationStatus: "none", reservationReady: false };
  }

  if (reservationStatuses.some((s) => s === "blocked")) {
    return { reservationStatus: "blocked", reservationReady: false };
  }

  const readyStatus = reservationStatuses.find((s) =>
    RESERVATION_READY_STATUSES.has(s as ReservationReadinessStatus),
  ) as ReservationReadinessStatus | undefined;

  if (readyStatus) {
    return { reservationStatus: readyStatus, reservationReady: true };
  }

  if (reservationStatuses.some((s) => s === "fulfilled")) {
    return { reservationStatus: "fulfilled", reservationReady: true };
  }

  if (reservationStatuses.some((s) => s === "pending")) {
    return { reservationStatus: "pending", reservationReady: false };
  }

  return { reservationStatus: "none", reservationReady: false };
}
