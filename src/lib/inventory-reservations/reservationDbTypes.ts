/** Supabase row shapes for Phase 4A inventory reservation tables. */

export type InventoryReservationRow = {
  id: string;
  reservation_number: string;
  order_id: string;
  queue_item_id: string | null;
  customer_id: string | null;
  product_id: string;
  sku: string;
  requested_qty: number | string;
  reserved_qty: number | string;
  fulfilled_qty: number | string;
  released_qty: number | string;
  reservation_status: string;
  reservation_priority: string;
  source_department: string | null;
  reserved_by: string | null;
  approved_by: string | null;
  expires_at: string | null;
  notes: string | null;
  correlation_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type InventoryReservationInsertRow = Omit<InventoryReservationRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type InventoryAllocationRow = {
  id: string;
  reservation_id: string;
  inventory_entity_type: string;
  inventory_entity_id: string;
  allocated_qty: number | string;
  allocation_status: string;
  allocated_at: string;
};

export type InventoryAllocationInsertRow = Omit<InventoryAllocationRow, "id" | "allocated_at"> & {
  id?: string;
  allocated_at?: string;
};

export type InventoryMovementRow = {
  id: string;
  movement_type: string;
  reservation_id: string | null;
  product_id: string;
  sku: string;
  quantity: number | string;
  source_location: string | null;
  destination_location: string | null;
  actor_id: string | null;
  reason_code: string | null;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type InventoryMovementInsertRow = Omit<InventoryMovementRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
