import type { ReservationStatus } from "./reservationTypes";

export const RESERVATION_VALID_NEXT: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["reserved", "partially_reserved", "blocked", "cancelled"],
  partially_reserved: ["reserved", "partially_reserved", "blocked", "released", "cancelled", "expired"],
  reserved: ["partially_reserved", "released", "fulfilled", "expired", "cancelled", "blocked"],
  blocked: ["pending", "partially_reserved", "reserved", "cancelled", "released"],
  released: [],
  expired: [],
  fulfilled: [],
  cancelled: [],
};

export function isReservationStatusTransitionValid(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_VALID_NEXT[from]?.includes(to) ?? false;
}

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!isReservationStatusTransitionValid(from, to)) {
    throw new Error(`Invalid reservation transition: ${from} → ${to}`);
  }
}

export function statusAfterReserve(
  current: ReservationStatus,
  requestedQty: number,
  reservedQty: number,
): ReservationStatus {
  if (reservedQty <= 0) return current;
  if (reservedQty >= requestedQty) return "reserved";
  return "partially_reserved";
}

/** Shared read-side truth for non-terminal inventory reservation states. */
export const OPEN_INVENTORY_RESERVATION_STATUSES = [
  "pending", "reserved", "partially_reserved", "blocked",
] as const satisfies readonly ReservationStatus[];

export function isReservationOpen(status: ReservationStatus): boolean {
  return (OPEN_INVENTORY_RESERVATION_STATUSES as readonly string[]).includes(status);
}
