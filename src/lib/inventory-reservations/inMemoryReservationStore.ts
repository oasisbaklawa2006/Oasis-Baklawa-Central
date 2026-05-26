import type {
  InventoryMovementRecord,
  InventoryReservationRecord,
  ReservationAllocationRecord,
} from "./reservationTypes";

function reservationKey(id: string): string {
  return id;
}

export function createInMemoryReservationStore() {
  const reservations = new Map<string, InventoryReservationRecord>();
  const allocations = new Map<string, ReservationAllocationRecord[]>();
  const movements: InventoryMovementRecord[] = [];

  return {
    async getReservation(id: string) {
      return reservations.get(reservationKey(id)) ?? null;
    },

    async listReservationsByOrder(orderId: string) {
      return [...reservations.values()].filter((r) => r.orderId === orderId);
    },

    async listReservationsBySku(sku: string) {
      return [...reservations.values()].filter((r) => r.sku === sku);
    },

    async listOpenReservationsForSku(sku: string) {
      return [...reservations.values()].filter(
        (r) =>
          r.sku === sku &&
          ["pending", "reserved", "partially_reserved", "blocked"].includes(r.reservationStatus),
      );
    },

    async insertReservation(row: InventoryReservationRecord) {
      reservations.set(reservationKey(row.id), row);
      allocations.set(row.id, []);
      return row;
    },

    async updateReservation(
      id: string,
      expectedVersion: number,
      patch: Partial<InventoryReservationRecord>,
    ) {
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

    async insertAllocations(rows: ReservationAllocationRecord[]) {
      const rid = rows[0]?.reservationId;
      if (!rid) return rows;
      const list = allocations.get(rid) ?? [];
      allocations.set(rid, [...list, ...rows]);
      return rows;
    },

    async getAllocations(reservationId: string) {
      return allocations.get(reservationId) ?? [];
    },

    async appendMovement(row: InventoryMovementRecord) {
      movements.push(row);
      return row;
    },

    async listMovementsForReservation(reservationId: string) {
      return movements.filter((m) => m.reservationId === reservationId);
    },

    _allReservations() {
      return [...reservations.values()];
    },

    _allMovements() {
      return [...movements];
    },
  };
}

export type InMemoryReservationStore = ReturnType<typeof createInMemoryReservationStore>;
