import type {
  InventoryMovementRecord,
  InventoryReservationRecord,
  InventoryMovementType,
  ReservationAllocationRecord,
  ReservationPriority,
  ReservationStatus,
} from "./reservationTypes";
import type {
  InventoryAllocationRow,
  InventoryMovementRow,
  InventoryReservationRow,
} from "./reservationDbTypes";

export function toNumber(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

export function mapReservationRow(row: InventoryReservationRow): InventoryReservationRecord {
  return {
    id: row.id,
    reservationNumber: row.reservation_number,
    orderId: row.order_id,
    queueItemId: row.queue_item_id,
    customerId: row.customer_id,
    productId: row.product_id,
    sku: row.sku,
    requestedQty: toNumber(row.requested_qty),
    reservedQty: toNumber(row.reserved_qty),
    fulfilledQty: toNumber(row.fulfilled_qty),
    releasedQty: toNumber(row.released_qty),
    reservationStatus: row.reservation_status as ReservationStatus,
    reservationPriority: row.reservation_priority as ReservationPriority,
    sourceDepartment: row.source_department,
    reservedBy: row.reserved_by,
    approvedBy: row.approved_by,
    expiresAt: row.expires_at,
    notes: row.notes,
    correlationId: row.correlation_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReservationToInsertRow(
  record: InventoryReservationRecord,
): Record<string, unknown> {
  return {
    id: record.id,
    reservation_number: record.reservationNumber,
    order_id: record.orderId,
    queue_item_id: record.queueItemId,
    customer_id: record.customerId,
    product_id: record.productId,
    sku: record.sku,
    requested_qty: record.requestedQty,
    reserved_qty: record.reservedQty,
    fulfilled_qty: record.fulfilledQty,
    released_qty: record.releasedQty,
    reservation_status: record.reservationStatus,
    reservation_priority: record.reservationPriority,
    source_department: record.sourceDepartment,
    reserved_by: record.reservedBy,
    approved_by: record.approvedBy,
    expires_at: record.expiresAt,
    notes: record.notes,
    correlation_id: record.correlationId,
    version: record.version,
    updated_at: record.updatedAt ?? new Date().toISOString(),
  };
}

export function mapReservationPatchToRow(
  patch: Partial<InventoryReservationRecord>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.reservedQty !== undefined) row.reserved_qty = patch.reservedQty;
  if (patch.fulfilledQty !== undefined) row.fulfilled_qty = patch.fulfilledQty;
  if (patch.releasedQty !== undefined) row.released_qty = patch.releasedQty;
  if (patch.reservationStatus !== undefined) row.reservation_status = patch.reservationStatus;
  if (patch.reservedBy !== undefined) row.reserved_by = patch.reservedBy;
  if (patch.approvedBy !== undefined) row.approved_by = patch.approvedBy;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
  return row;
}

export function mapAllocationRow(row: InventoryAllocationRow): ReservationAllocationRecord {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    inventoryEntityType: row.inventory_entity_type,
    inventoryEntityId: row.inventory_entity_id,
    allocatedQty: toNumber(row.allocated_qty),
    allocationStatus: row.allocation_status,
    allocatedAt: row.allocated_at,
  };
}

export function mapAllocationToInsertRow(record: ReservationAllocationRecord): Record<string, unknown> {
  return {
    id: record.id,
    reservation_id: record.reservationId,
    inventory_entity_type: record.inventoryEntityType,
    inventory_entity_id: record.inventoryEntityId,
    allocated_qty: record.allocatedQty,
    allocation_status: record.allocationStatus,
    allocated_at: record.allocatedAt ?? new Date().toISOString(),
  };
}

export function mapMovementRow(row: InventoryMovementRow): InventoryMovementRecord {
  return {
    id: row.id,
    movementType: row.movement_type as InventoryMovementType,
    reservationId: row.reservation_id,
    productId: row.product_id,
    sku: row.sku,
    quantity: toNumber(row.quantity),
    sourceLocation: row.source_location,
    destinationLocation: row.destination_location,
    actorId: row.actor_id,
    reasonCode: row.reason_code,
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function mapMovementToInsertRow(
  record: Omit<InventoryMovementRecord, "id" | "createdAt"> & { id?: string },
): Record<string, unknown> {
  return {
    id: record.id,
    movement_type: record.movementType,
    reservation_id: record.reservationId,
    product_id: record.productId,
    sku: record.sku,
    quantity: record.quantity,
    source_location: record.sourceLocation,
    destination_location: record.destinationLocation,
    actor_id: record.actorId,
    reason_code: record.reasonCode,
    correlation_id: record.correlationId,
    metadata: record.metadata ?? {},
  };
}
