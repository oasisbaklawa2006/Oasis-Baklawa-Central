import type {
  InventoryMovementRecord,
  InventoryReservationRecord,
  ReservationAllocationRecord,
} from "./reservationTypes";
import type { InventoryReservationStore } from "./reservationStoreContract";
import { validateAllocationInsert, validateInventoryMovementInsert } from "./supabaseInventoryReservationStore";

function reservationKey(id: string): string {
  return id;
}

/** In-memory store for unit tests and explicit test-mode fallback only. */
export function createInMemoryReservationStore(): InventoryReservationStore & {
  _allReservations(): InventoryReservationRecord[];
  _allMovements(): InventoryMovementRecord[];
} {
  const reservations = new Map<string, InventoryReservationRecord>();
  const allocations = new Map<string, ReservationAllocationRecord[]>();
  const movements: InventoryMovementRecord[] = [];

  const store: InventoryReservationStore & {
    _allReservations(): InventoryReservationRecord[];
    _allMovements(): InventoryMovementRecord[];
  } = {
    async getReservationById(id) {
      return reservations.get(reservationKey(id)) ?? null;
    },

    async listReservationsByOrder(orderId) {
      return [...reservations.values()].filter((r) => r.orderId === orderId);
    },

    async listReservationsBySku(sku) {
      return [...reservations.values()].filter((r) => r.sku === sku);
    },

    async listOpenReservations(sku) {
      return [...reservations.values()].filter(
        (r) =>
          r.sku === sku &&
          ["pending", "reserved", "partially_reserved", "blocked"].includes(r.reservationStatus),
      );
    },

    async createReservationRow(row) {
      reservations.set(reservationKey(row.id), row);
      allocations.set(row.id, []);
      return row;
    },

    async updateReservationWithVersion(id, expectedVersion, patch) {
      const current = reservations.get(reservationKey(id));
      if (!current) throw new Error("Reservation not found");
      if (current.version !== expectedVersion) {
        throw new Error(`Stale reservation version: expected ${expectedVersion}, got ${current.version}`);
      }
      const next: InventoryReservationRecord = {
        ...current,
        ...patch,
        version: expectedVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      reservations.set(reservationKey(id), next);
      return next;
    },

    async insertAllocationRow(row) {
      validateAllocationInsert(row);
      const list = allocations.get(row.reservationId) ?? [];
      allocations.set(row.reservationId, [...list, row]);
      return row;
    },

    async insertAllocationRows(rows) {
      const out: ReservationAllocationRecord[] = [];
      for (const row of rows) {
        out.push(await store.insertAllocationRow(row));
      }
      return out;
    },

    async listAllocationsByReservation(reservationId) {
      return allocations.get(reservationId) ?? [];
    },

    async insertInventoryMovement(row) {
      validateInventoryMovementInsert(row);
      const record: InventoryMovementRecord = {
        id: row.id ?? crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        movementType: row.movementType,
        reservationId: row.reservationId,
        productId: row.productId,
        sku: row.sku,
        quantity: row.quantity,
        sourceLocation: row.sourceLocation,
        destinationLocation: row.destinationLocation,
        actorId: row.actorId,
        reasonCode: row.reasonCode,
        correlationId: row.correlationId,
        metadata: row.metadata ?? {},
      };
      movements.push(record);
      return record;
    },

    async listMovementsByReservation(reservationId) {
      return movements.filter((m) => m.reservationId === reservationId);
    },

    _allReservations() {
      return [...reservations.values()];
    },

    _allMovements() {
      return [...movements];
    },
  };

  return store;
}

export type InMemoryReservationStore = ReturnType<typeof createInMemoryReservationStore>;
