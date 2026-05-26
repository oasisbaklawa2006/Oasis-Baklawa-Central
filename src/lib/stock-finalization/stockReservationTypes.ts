/** Minimal reservation shape for Phase 4G reconciliation (aligns with Phase 4A schema). */

export const CONSUMABLE_RESERVATION_STATUSES = [
  "reserved",
  "fulfilled",
  "partially_reserved",
] as const;

export type ConsumableReservationStatus = (typeof CONSUMABLE_RESERVATION_STATUSES)[number];

export interface StockReservationRecord {
  id: string;
  reservationNumber: string;
  orderId: string;
  productId: string;
  sku: string;
  requestedQty: number;
  reservedQty: number;
  fulfilledQty: number;
  releasedQty: number;
  reservationStatus: string;
}
