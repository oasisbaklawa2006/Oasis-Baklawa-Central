import type { InventoryAvailabilitySnapshot } from "./reservationTypes";
import { ReservationError } from "./reservationTypes";

/** Deterministic availability — no silent assumptions. */
export function computeAvailableInventory(snapshot: InventoryAvailabilitySnapshot): number {
  const available =
    snapshot.physicalStock -
    snapshot.reservedOpen -
    snapshot.blockedInventory -
    snapshot.damagedInventory -
    snapshot.expiredInventory -
    snapshot.quarantineInventory;
  return Math.max(0, roundQty(available));
}

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function assertCanReserveQty(
  snapshot: InventoryAvailabilitySnapshot,
  additionalQty: number,
): void {
  const available = computeAvailableInventory(snapshot);
  if (additionalQty > available + 0.0001) {
    throw new ReservationError(
      "insufficient_inventory",
      `Insufficient inventory for ${snapshot.sku}: requested ${additionalQty}, available ${available}`,
    );
  }
}

export function assertNoOverAllocation(
  requestedQty: number,
  reservedQty: number,
  additionalQty: number,
): void {
  const next = roundQty(reservedQty + additionalQty);
  if (next > requestedQty + 0.0001) {
    throw new ReservationError(
      "over_allocation",
      `Over-allocation: ${next} exceeds requested ${requestedQty}`,
    );
  }
}
