import { computeAvailableInventory } from "./reservationAvailability";
import type { InventoryAvailabilitySnapshot } from "./reservationTypes";

export interface BalanceSliceForSnapshot {
  availableQty: number;
  reservedQty: number;
}

/** Build caller-provided availability snapshot from balance + open reservation holds. */
export function buildAvailabilitySnapshotFromBalance(params: {
  productId: string;
  sku: string;
  balance: BalanceSliceForSnapshot | null;
  openReservedQty: number;
}): InventoryAvailabilitySnapshot {
  const availableQty = params.balance?.availableQty ?? 0;
  const reservedQty = params.balance?.reservedQty ?? 0;
  return {
    productId: params.productId,
    sku: params.sku,
    physicalStock: availableQty + reservedQty,
    reservedOpen: Math.max(0, params.openReservedQty),
    blockedInventory: 0,
    damagedInventory: 0,
    expiredInventory: 0,
    quarantineInventory: 0,
  };
}

export function summarizeAvailability(snapshot: InventoryAvailabilitySnapshot) {
  const available = computeAvailableInventory(snapshot);
  return {
    snapshot,
    availableQty: available,
    physicalStock: snapshot.physicalStock,
    reservedOpen: snapshot.reservedOpen,
  };
}
