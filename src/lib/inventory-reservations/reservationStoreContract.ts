import type {
  InventoryMovementRecord,
  InventoryReservationRecord,
  ReservationAllocationRecord,
} from "./reservationTypes";

/** Persistence contract for reservation repository (in-memory or Supabase). */
export interface InventoryReservationStore {
  getReservationById(id: string): Promise<InventoryReservationRecord | null>;
  listReservationsByOrder(orderId: string): Promise<InventoryReservationRecord[]>;
  listReservationsBySku(sku: string): Promise<InventoryReservationRecord[]>;
  listOpenReservations(sku: string): Promise<InventoryReservationRecord[]>;
  createReservationRow(row: InventoryReservationRecord): Promise<InventoryReservationRecord>;
  updateReservationWithVersion(
    id: string,
    expectedVersion: number,
    patch: Partial<InventoryReservationRecord>,
  ): Promise<InventoryReservationRecord>;
  insertAllocationRow(row: ReservationAllocationRecord): Promise<ReservationAllocationRecord>;
  insertAllocationRows(rows: ReservationAllocationRecord[]): Promise<ReservationAllocationRecord[]>;
  listAllocationsByReservation(reservationId: string): Promise<ReservationAllocationRecord[]>;
  insertInventoryMovement(
    row: Omit<InventoryMovementRecord, "id" | "createdAt"> & { id?: string },
  ): Promise<InventoryMovementRecord>;
  listMovementsByReservation(reservationId: string): Promise<InventoryMovementRecord[]>;
}
