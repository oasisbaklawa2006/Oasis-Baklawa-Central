/**
 * Factory RGS line attribution uses the original order_items.id rather than
 * order_id+product_id. Multiple SO lines can carry the same product.
 * Existing unlabelled historical reservations must be reconciled, not guessed.
 * This is read-only linkage; Core RPCs remain the sole stock authority.
 */
export const factoryOrderLineReference = (orderItemId: string): string =>
  `order_item:${orderItemId}`;

export type FactoryLineReservation = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  demand_reference: string | null;
  reservation_status: string;
  reserved_qty: number;
};

/**
 * Terminal inventory_reservations.reservation_status values per Core's
 * inventory_reservations_status_check (pending, reserved, partially_reserved,
 * blocked, released, expired, fulfilled, cancelled). A terminal reservation
 * holds no custody and cannot be allocated, picked, issued or released.
 */
export const TERMINAL_RESERVATION_STATUSES: ReadonlySet<string> = new Set([
  "released", "fulfilled", "cancelled", "expired",
]);

export const isTerminalReservation = (reservation: { reservation_status: string }): boolean =>
  TERMINAL_RESERVATION_STATUSES.has(reservation.reservation_status);

/**
 * A legacy reservation is one with no `order_item:` source-line anchor. It is
 * UNRESOLVED (needs governed reconciliation) only while it is non-terminal and
 * still holds stock. It is never auto-assigned to any sales-order line.
 */
export const isUnresolvedLegacyReservation = (reservation: FactoryLineReservation): boolean =>
  !reservation.demand_reference?.startsWith("order_item:") &&
  !isTerminalReservation(reservation) &&
  Number(reservation.reserved_qty) > 0;

export function resolveFactoryLineReservations<T extends FactoryLineReservation>(
  line: { id: string; order_id: string; product_id: string | null },
  reservations: T[],
): { matched: T[]; ambiguousLegacy: boolean } {
  const reference = factoryOrderLineReference(line.id);
  const sameSku = reservations.filter(
    (item) => item.order_id === line.order_id && item.product_id != null && item.product_id === line.product_id,
  );
  return {
    matched: sameSku.filter((item) => item.demand_reference === reference),
    // Terminal or zero-qty legacy rows hold no custody and must not block.
    ambiguousLegacy: sameSku.some(isUnresolvedLegacyReservation),
  };
}

export function isFactoryJobForLine(
  job: { order_item_id: string | null; reservation_id: string | null },
  lineId: string,
  lineReservationIds: Set<string>,
): boolean {
  return job.order_item_id === lineId ||
    (!!job.reservation_id && lineReservationIds.has(job.reservation_id));
}
