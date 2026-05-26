import { createInMemoryOperationalEventRepository } from "@/lib/operational-events/inMemoryOperationalEventRepository";
import { createInMemoryReservationStore } from "./inMemoryReservationStore";
import { createReservationRepository, type ReservationRepository } from "./reservationRepository";
import type {
  CreateReservationInput,
  InventoryAvailabilitySnapshot,
  ReservationWriteContext,
  ReserveInventoryInput,
  ReservationVersionedInput,
} from "./reservationTypes";

export interface ReservationServiceBundle {
  repository: ReservationRepository;
  /** Test-only accessors */
  _store: ReturnType<typeof createInMemoryReservationStore>;
  _events: ReturnType<typeof createInMemoryOperationalEventRepository>;
}

export function createInMemoryReservationServiceBundle(): ReservationServiceBundle {
  const store = createInMemoryReservationStore();
  const events = createInMemoryOperationalEventRepository();
  const repository = createReservationRepository({ store, events });
  return { repository, _store: store, _events: events };
}

/** Governed reservation engine — all writes via repository (movements + events). */
export function createReservationService(bundle: ReservationServiceBundle) {
  const { repository } = bundle;
  return {
    createReservation: (input: CreateReservationInput, ctx: ReservationWriteContext) =>
      repository.createReservation(input, ctx),
    reserveInventory: (
      input: ReserveInventoryInput,
      ctx: ReservationWriteContext,
      availability: InventoryAvailabilitySnapshot,
    ) => repository.reserveInventory(input, ctx, availability),
    partiallyReserveInventory: (
      input: ReserveInventoryInput,
      ctx: ReservationWriteContext,
      availability: InventoryAvailabilitySnapshot,
    ) => repository.reserveInventory(input, ctx, availability),
    releaseReservation: (input: ReservationVersionedInput, ctx: ReservationWriteContext) =>
      repository.releaseReservation(input, ctx),
    expireReservation: (input: ReservationVersionedInput, ctx: ReservationWriteContext) =>
      repository.expireReservation(input, ctx),
    fulfillReservation: (input: ReservationVersionedInput, ctx: ReservationWriteContext) =>
      repository.fulfillReservation(input, ctx),
    cancelReservation: (input: ReservationVersionedInput, ctx: ReservationWriteContext) =>
      repository.cancelReservation(input, ctx),
    attachReservationNote: async (
      reservationId: string,
      note: string,
      ctx: ReservationWriteContext,
    ) => {
      const row = await repository.getReservation(reservationId);
      if (!row) throw new Error("Reservation not found");
      await bundle._events.appendEvent({
        eventType: "operational_note_added",
        entityType: "inventory_reservation",
        entityId: reservationId,
        orderId: row.orderId,
        title: `Note on ${row.reservationNumber}`,
        message: note,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        correlationId: ctx.correlationId,
      });
      return row;
    },
    listByOrder: repository.listByOrder,
    getReservation: repository.getReservation,
    listMovements: repository.listMovements,
  };
}

export type ReservationService = ReturnType<typeof createReservationService>;
