import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAllocationRow,
  mapAllocationToInsertRow,
  mapMovementRow,
  mapMovementToInsertRow,
  mapReservationPatchToRow,
  mapReservationRow,
  mapReservationToInsertRow,
} from "./reservationDbMappers";
import {
  assertReservationUpdateAffected,
  isReservationTablesMissingError,
} from "./reservationConcurrency";
import type { InventoryReservationStore } from "./reservationStoreContract";
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryMovementRecord,
  type InventoryReservationRecord,
  type ReservationAllocationRecord,
} from "./reservationTypes";
import type {
  InventoryAllocationRow,
  InventoryMovementRow,
  InventoryReservationRow,
} from "./reservationDbTypes";

const OPEN_STATUSES = ["pending", "reserved", "partially_reserved", "blocked"] as const;

const ALLOWED_MOVEMENT_TYPES = new Set<string>([
  ...(INVENTORY_MOVEMENT_TYPES as readonly string[]),
]);

type UntypedClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient["from"]>;
};

function reservationDb(client: SupabaseClient): UntypedClient {
  return client as UntypedClient;
}

export function validateInventoryMovementInsert(
  row: Pick<InventoryMovementRecord, "movementType" | "correlationId" | "productId" | "sku" | "quantity">,
): void {
  if (!row.correlationId?.trim()) {
    throw new Error("inventory_movements requires correlation_id");
  }
  if (!row.productId || !row.sku) {
    throw new Error("inventory_movements requires product_id and sku");
  }
  if (row.quantity === undefined || row.quantity === null || Number.isNaN(Number(row.quantity))) {
    throw new Error("inventory_movements requires quantity");
  }
  const type = row.movementType as string;
  if (type === "deduct_stock" || !ALLOWED_MOVEMENT_TYPES.has(type)) {
    throw new Error(`Disallowed inventory movement type: ${type}`);
  }
}

export function validateAllocationInsert(row: Pick<ReservationAllocationRecord, "allocatedQty" | "allocationStatus">): void {
  if (row.allocatedQty <= 0) {
    throw new Error("allocated_qty must be positive");
  }
  const allowed = ["active", "released", "expired", "fulfilled", "cancelled"];
  if (!allowed.includes(row.allocationStatus)) {
    throw new Error(`Invalid allocation_status: ${row.allocationStatus}`);
  }
}

export function createSupabaseInventoryReservationStore(client: SupabaseClient): InventoryReservationStore {
  const db = reservationDb(client);

  return {
    async getReservationById(id) {
      const { data, error } = await db.from("inventory_reservations").select("*").eq("id", id).maybeSingle();
      if (error) {
        if (isReservationTablesMissingError(error.message)) {
          throw new Error(
            "inventory_reservations table missing — apply migration 20260526030000_execution_os_phase4a_inventory_reservation.sql",
          );
        }
        throw new Error(error.message);
      }
      return data ? mapReservationRow(data as InventoryReservationRow) : null;
    },

    async listReservationsByOrder(orderId) {
      const { data, error } = await db
        .from("inventory_reservations")
        .select("*")
        .eq("order_id", orderId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as InventoryReservationRow[]).map(mapReservationRow);
    },

    async listReservationsBySku(sku) {
      const { data, error } = await db
        .from("inventory_reservations")
        .select("*")
        .eq("sku", sku)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as InventoryReservationRow[]).map(mapReservationRow);
    },

    async listOpenReservations(sku) {
      const { data, error } = await db
        .from("inventory_reservations")
        .select("*")
        .eq("sku", sku)
        .in("reservation_status", [...OPEN_STATUSES]);
      if (error) throw new Error(error.message);
      return ((data ?? []) as InventoryReservationRow[]).map(mapReservationRow);
    },

    async createReservationRow(row) {
      const payload = mapReservationToInsertRow(row);
      const { data, error } = await db.from("inventory_reservations").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return mapReservationRow(data as InventoryReservationRow);
    },

    async updateReservationWithVersion(id, expectedVersion, patch) {
      const rowPatch = mapReservationPatchToRow(patch);
      const nextVersion = expectedVersion + 1;
      const { data, error } = await db
        .from("inventory_reservations")
        .update({ ...rowPatch, version: nextVersion })
        .eq("id", id)
        .eq("version", expectedVersion)
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        assertReservationUpdateAffected(0, expectedVersion);
      }
      return mapReservationRow(data as InventoryReservationRow);
    },

    async insertAllocationRow(row) {
      validateAllocationInsert(row);
      const payload = mapAllocationToInsertRow(row);
      const { data, error } = await db
        .from("inventory_reservation_allocations")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapAllocationRow(data as InventoryAllocationRow);
    },

    async insertAllocationRows(rows) {
      const out: ReservationAllocationRecord[] = [];
      for (const row of rows) {
        out.push(await this.insertAllocationRow(row));
      }
      return out;
    },

    async listAllocationsByReservation(reservationId) {
      const { data, error } = await db
        .from("inventory_reservation_allocations")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("allocated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as InventoryAllocationRow[]).map(mapAllocationRow);
    },

    async insertInventoryMovement(row) {
      validateInventoryMovementInsert(row);
      const payload = mapMovementToInsertRow(row);
      const { data, error } = await db.from("inventory_movements").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return mapMovementRow(data as InventoryMovementRow);
    },

    async listMovementsByReservation(reservationId) {
      const { data, error } = await db
        .from("inventory_movements")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as InventoryMovementRow[]).map(mapMovementRow);
    },
  };
}

/** Probe that reservation tables exist (lightweight SELECT). */
export async function probeInventoryReservationTables(client: SupabaseClient): Promise<boolean> {
  const { error } = await reservationDb(client).from("inventory_reservations").select("id").limit(1);
  if (!error) return true;
  if (isReservationTablesMissingError(error.message)) return false;
  throw new Error(error.message);
}
