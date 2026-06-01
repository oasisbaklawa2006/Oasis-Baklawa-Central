/** Phase 4A — governed inventory reservation domain types. */

import type { InventoryReservationWriteChannel } from "@/lib/inventory-authority/inventoryAuthorityTypes";

export const RESERVATION_STATUSES = [
  "pending",
  "reserved",
  "partially_reserved",
  "blocked",
  "released",
  "expired",
  "fulfilled",
  "cancelled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ReservationPriority = (typeof RESERVATION_PRIORITIES)[number];

export const INVENTORY_MOVEMENT_TYPES = [
  "reservation_created",
  "reservation_adjusted",
  "reservation_released",
  "reservation_expired",
  "reservation_fulfilled",
  "inventory_hold",
  "inventory_unhold",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const RESERVATION_OPERATIONAL_EVENT_TYPES = [
  "reservation_created",
  "reservation_reserved",
  "reservation_partially_reserved",
  "reservation_blocked",
  "reservation_released",
  "reservation_expired",
  "reservation_fulfilled",
  "reservation_cancelled",
  "reservation_conflict_detected",
] as const;

export type ReservationOperationalEventType = (typeof RESERVATION_OPERATIONAL_EVENT_TYPES)[number];

export interface InventoryReservationRecord {
  id: string;
  reservationNumber: string;
  orderId: string;
  queueItemId: string | null;
  customerId: string | null;
  productId: string;
  sku: string;
  requestedQty: number;
  reservedQty: number;
  fulfilledQty: number;
  releasedQty: number;
  reservationStatus: ReservationStatus;
  reservationPriority: ReservationPriority;
  sourceDepartment: string | null;
  reservedBy: string | null;
  approvedBy: string | null;
  expiresAt: string | null;
  notes: string | null;
  correlationId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationAllocationRecord {
  id: string;
  reservationId: string;
  inventoryEntityType: string;
  inventoryEntityId: string;
  allocatedQty: number;
  allocationStatus: string;
  allocatedAt: string;
}

export interface InventoryMovementRecord {
  id: string;
  movementType: InventoryMovementType;
  reservationId: string | null;
  productId: string;
  sku: string;
  quantity: number;
  sourceLocation: string | null;
  destinationLocation: string | null;
  actorId: string | null;
  reasonCode: string | null;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReservationWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  writeChannel?: InventoryReservationWriteChannel;
}

export interface CreateReservationInput {
  orderId: string;
  productId: string;
  sku: string;
  requestedQty: number;
  queueItemId?: string | null;
  customerId?: string | null;
  reservationPriority?: ReservationPriority;
  sourceDepartment?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export interface ReservationVersionedInput {
  reservationId: string;
  expectedVersion: number;
  reason?: string | null;
  reasonCode?: string | null;
}

export interface ReserveInventoryInput extends ReservationVersionedInput {
  reserveQty: number;
  allocations?: Array<{
    inventoryEntityType: string;
    inventoryEntityId: string;
    allocatedQty: number;
  }>;
}

export interface InventoryAvailabilitySnapshot {
  productId: string;
  sku: string;
  physicalStock: number;
  reservedOpen: number;
  blockedInventory: number;
  damagedInventory: number;
  expiredInventory: number;
  quarantineInventory: number;
}

export interface ReservationWriteResult {
  reservation: InventoryReservationRecord;
  movementId: string;
  eventId: string;
}

export type ReservationErrorCode =
  | "stale_version"
  | "insufficient_inventory"
  | "competing_reservation"
  | "over_allocation"
  | "invalid_transition"
  | "authority_denied"
  | "expired_allocation"
  | "blocked_source";

export class ReservationError extends Error {
  constructor(
    public readonly code: ReservationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReservationError";
  }
}
