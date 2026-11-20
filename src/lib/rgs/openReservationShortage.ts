/**
 * RGS shortage truth after reservation/release.
 *
 * Core's release_rgs_reservation moves stock out of reserved_qty and records
 * released_qty as historical movement evidence. Never subtract released_qty
 * again: an original request for 10, reserved now 8, released 2 has 2 units
 * of uncovered demand (unless fulfilled_qty also covers those units).
 *
 * This helper is read-only arithmetic; Core remains the sole stock writer.
 */
export function calculateOpenRgsReservationShortage(reservation: {
  requested_qty: unknown;
  reserved_qty: unknown;
  fulfilled_qty: unknown;
}): number {
  const numeric = (value: unknown, key: string): number => {
    if (value === null || value === undefined || value === "") {
      throw new Error(`Core RGS reservation missing ${key}`);
    }
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`Core RGS reservation has invalid ${key}`);
    }
    return quantity;
  };
  const requested = numeric(reservation.requested_qty, "requested_qty");
  const reserved = numeric(reservation.reserved_qty, "reserved_qty");
  const fulfilled = numeric(reservation.fulfilled_qty, "fulfilled_qty");
  return Math.max(0, requested - reserved - fulfilled);
}
