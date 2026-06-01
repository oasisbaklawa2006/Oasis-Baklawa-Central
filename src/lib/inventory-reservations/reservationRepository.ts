import { assertInventoryReservationAuthority } from "@/lib/inventory-authority/inventoryAuthorityGuard";
import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import type { AppendOperationalEventInput } from "@/lib/operational-events/operationalEventTypes";
import { assertCanReserveQty, assertNoOverAllocation, roundQty } from "./reservationAvailability";
import { buildAllocationRows } from "./reservationAllocationEngine";
import { movementTypeForTransition, statusToEventType } from "./reservationEventBridge";
import { assertReservationTransition, statusAfterReserve } from "./reservationLifecycle";
import { defaultExpiryForPriority } from "./reservationPriority";
import type { InventoryReservationStore } from "./reservationStoreContract";
import type {
  CreateReservationInput,
  InventoryAvailabilitySnapshot,
  InventoryMovementRecord,
  InventoryReservationRecord,
  ReservationAllocationRecord,
  ReservationWriteContext,
  ReservationWriteResult,
  ReserveInventoryInput,
  ReservationVersionedInput,
} from "./reservationTypes";
import { ReservationError as RE } from "./reservationTypes";

function generateReservationNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RES-${t}-${r}`;
}

function mapStaleError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Stale reservation version")) {
    throw new RE("stale_version", msg);
  }
  throw err instanceof Error ? err : new Error(msg);
}

export interface ReservationRepositoryDeps {
  store: InventoryReservationStore;
  events: OperationalEventRepository;
}

export function createReservationRepository(deps: ReservationRepositoryDeps) {
  const { store, events } = deps;

  async function appendMovement(
    partial: Omit<InventoryMovementRecord, "id" | "createdAt">,
  ): Promise<InventoryMovementRecord> {
    return store.insertInventoryMovement(partial);
  }

  async function appendReservationEvent(
    input: Omit<AppendOperationalEventInput, "actorId" | "actorRole" | "visibility">,
    ctx: ReservationWriteContext,
  ): Promise<string> {
    const record = await events.appendEvent({
      ...input,
      actorId: ctx.actorUserId,
      actorRole: ctx.actorRole,
      actorDepartment: ctx.actorDepartment ?? null,
      visibility: "internal",
      correlationId: ctx.correlationId,
      idempotencyKey: ctx.idempotencyKey ?? null,
    });
    return record.id;
  }

  return {
    async createReservation(
      input: CreateReservationInput,
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      const auth = assertInventoryReservationAuthority("reservation:create", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
        actorDepartment: ctx.actorDepartment,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);

      const now = new Date().toISOString();
      const priority = input.reservationPriority ?? "normal";
      const row: InventoryReservationRecord = {
        id: crypto.randomUUID(),
        reservationNumber: generateReservationNumber(),
        orderId: input.orderId,
        queueItemId: input.queueItemId ?? null,
        customerId: input.customerId ?? null,
        productId: input.productId,
        sku: input.sku,
        requestedQty: roundQty(input.requestedQty),
        reservedQty: 0,
        fulfilledQty: 0,
        releasedQty: 0,
        reservationStatus: "pending",
        reservationPriority: priority,
        sourceDepartment: input.sourceDepartment ?? null,
        reservedBy: ctx.actorUserId,
        approvedBy: null,
        expiresAt: input.expiresAt ?? defaultExpiryForPriority(priority, now),
        notes: input.notes ?? null,
        correlationId: ctx.correlationId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await store.createReservationRow(row);

      const movement = await appendMovement({
        movementType: "reservation_created",
        reservationId: row.id,
        productId: row.productId,
        sku: row.sku,
        quantity: row.requestedQty,
        sourceLocation: null,
        destinationLocation: "reservation_hold",
        actorId: ctx.actorUserId,
        reasonCode: null,
        correlationId: ctx.correlationId,
        metadata: { reservationNumber: row.reservationNumber },
      });

      const eventId = await appendReservationEvent(
        {
          eventType: "reservation_created" as AppendOperationalEventInput["eventType"],
          entityType: "inventory_reservation",
          entityId: row.id,
          orderId: row.orderId,
          customerId: row.customerId,
          queueItemId: row.queueItemId,
          title: `Reservation ${row.reservationNumber} created`,
          message: `SKU ${row.sku} qty ${row.requestedQty}`,
          metadata: { sku: row.sku, requestedQty: row.requestedQty },
          correlationId: ctx.correlationId,
        },
        ctx,
      );

      return { reservation: row, movementId: movement.id, eventId };
    },

    async reserveInventory(
      input: ReserveInventoryInput,
      ctx: ReservationWriteContext,
      availability: InventoryAvailabilitySnapshot,
    ): Promise<ReservationWriteResult> {
      const existing = await store.getReservationById(input.reservationId);
      if (!existing) throw new Error("Reservation not found");
      const action =
        input.reserveQty < existing.requestedQty
          ? "reservation:partial_reserve"
          : "reservation:reserve";
      const auth = assertInventoryReservationAuthority(action, {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);

      const current = await store.getReservationById(input.reservationId);
      if (!current) throw new Error("Reservation not found");
      if (current.expiresAt && current.expiresAt < new Date().toISOString()) {
        throw new RE("expired_allocation", "Reservation expired");
      }

      assertNoOverAllocation(current.requestedQty, current.reservedQty, input.reserveQty);
      assertCanReserveQty(availability, input.reserveQty);

      const nextReserved = roundQty(current.reservedQty + input.reserveQty);
      const nextStatus = statusAfterReserve(current.reservationStatus, current.requestedQty, nextReserved);
      assertReservationTransition(current.reservationStatus, nextStatus);

      let updated: InventoryReservationRecord;
      try {
        updated = await store.updateReservationWithVersion(input.reservationId, input.expectedVersion, {
          reservedQty: nextReserved,
          reservationStatus: nextStatus,
          reservedBy: ctx.actorUserId,
        });
      } catch (e) {
        mapStaleError(e);
      }

      if (input.allocations?.length) {
        const allocRows: ReservationAllocationRecord[] = buildAllocationRows(
          updated.id,
          input.allocations,
        ).map((a) => ({
          ...a,
          id: crypto.randomUUID(),
          allocatedAt: new Date().toISOString(),
        }));
        await store.insertAllocationRows(allocRows);
      }

      const movement = await appendMovement({
        movementType: movementTypeForTransition(current.reservationStatus, nextStatus),
        reservationId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        quantity: input.reserveQty,
        sourceLocation: "available",
        destinationLocation: "reservation_hold",
        actorId: ctx.actorUserId,
        reasonCode: input.reasonCode ?? null,
        correlationId: ctx.correlationId,
        metadata: { reservedQty: nextReserved },
      });

      const eventId = await appendReservationEvent(
        {
          eventType: statusToEventType(
            nextStatus,
            nextStatus === "partially_reserved",
          ) as AppendOperationalEventInput["eventType"],
          entityType: "inventory_reservation",
          entityId: updated.id,
          orderId: updated.orderId,
          queueItemId: updated.queueItemId,
          title: `Reservation ${updated.reservationNumber} ${nextStatus}`,
          message: input.reason ?? null,
          metadata: { reservedQty: nextReserved, sku: updated.sku },
          correlationId: ctx.correlationId,
        },
        ctx,
      );

      return { reservation: updated, movementId: movement.id, eventId };
    },

    async releaseReservation(
      input: ReservationVersionedInput,
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      if (!input.reason?.trim()) throw new Error("Release requires reason");
      const auth = assertInventoryReservationAuthority("reservation:release", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);

      return transitionTerminal(input, ctx, "released", "reservation:release", input.reason);
    },

    async expireReservation(
      input: ReservationVersionedInput,
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      const auth = assertInventoryReservationAuthority("reservation:expire", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);
      return transitionTerminal(input, ctx, "expired", "reservation:expire", input.reason ?? "expired");
    },

    async fulfillReservation(
      input: ReservationVersionedInput,
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      const auth = assertInventoryReservationAuthority("reservation:fulfill", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);

      const current = await store.getReservationById(input.reservationId);
      if (!current) throw new Error("Reservation not found");
      let updated: InventoryReservationRecord;
      try {
        updated = await store.updateReservationWithVersion(input.reservationId, input.expectedVersion, {
          reservationStatus: "fulfilled",
          fulfilledQty: current.reservedQty,
        });
      } catch (e) {
        mapStaleError(e);
      }
      assertReservationTransition(current.reservationStatus, "fulfilled");

      const movement = await appendMovement({
        movementType: "reservation_fulfilled",
        reservationId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        quantity: updated.fulfilledQty,
        sourceLocation: "reservation_hold",
        destinationLocation: "fulfillment_lane",
        actorId: ctx.actorUserId,
        reasonCode: input.reasonCode ?? null,
        correlationId: ctx.correlationId,
        metadata: {},
      });

      const eventId = await appendReservationEvent(
        {
          eventType: "reservation_fulfilled" as AppendOperationalEventInput["eventType"],
          entityType: "inventory_reservation",
          entityId: updated.id,
          orderId: updated.orderId,
          title: `Reservation ${updated.reservationNumber} fulfilled`,
          correlationId: ctx.correlationId,
        },
        ctx,
      );
      return { reservation: updated, movementId: movement.id, eventId };
    },

    /** Post–Phase 4G: align reservation row with consumed stock (reserved_qty cleared). */
    async fulfillAfterStockConsumption(
      input: ReservationVersionedInput & { consumedQty: number },
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      const auth = assertInventoryReservationAuthority("reservation:fulfill", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);

      const current = await store.getReservationById(input.reservationId);
      if (!current) throw new Error("Reservation not found");
      assertReservationTransition(current.reservationStatus, "fulfilled");

      const consumedQty = roundQty(input.consumedQty);
      const nextFulfilled = roundQty(current.fulfilledQty + consumedQty);
      const nextReserved = Math.max(roundQty(current.reservedQty - consumedQty), 0);
      const fullyFulfilled =
        nextFulfilled >= current.requestedQty && current.requestedQty > 0;
      let updated: InventoryReservationRecord;
      try {
        updated = await store.updateReservationWithVersion(input.reservationId, input.expectedVersion, {
          reservationStatus: fullyFulfilled ? "fulfilled" : current.reservationStatus,
          reservedQty: nextReserved,
          fulfilledQty: nextFulfilled,
        });
      } catch (e) {
        mapStaleError(e);
      }

      const movement = await appendMovement({
        movementType: "reservation_fulfilled",
        reservationId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        quantity: consumedQty,
        sourceLocation: "reservation_hold",
        destinationLocation: "fulfillment_lane",
        actorId: ctx.actorUserId,
        reasonCode: input.reasonCode ?? "stock_consumption_finalized",
        correlationId: ctx.correlationId,
        metadata: { postStockFinalization: true, governed: true },
      });

      const eventId = await appendReservationEvent(
        {
          eventType: "reservation_fulfilled" as AppendOperationalEventInput["eventType"],
          entityType: "inventory_reservation",
          entityId: updated.id,
          orderId: updated.orderId,
          title: `Reservation ${updated.reservationNumber} fulfilled after stock consumption`,
          correlationId: ctx.correlationId,
        },
        ctx,
      );
      return { reservation: updated, movementId: movement.id, eventId };
    },

    async cancelReservation(
      input: ReservationVersionedInput,
      ctx: ReservationWriteContext,
    ): Promise<ReservationWriteResult> {
      if (!input.reason?.trim()) throw new Error("Cancel requires reason");
      const auth = assertInventoryReservationAuthority("reservation:cancel", {
        actorRole: ctx.actorRole,
        actorUserId: ctx.actorUserId,
      });
      if (!auth.allowed) throw new RE("authority_denied", auth.reason);
      return transitionTerminal(input, ctx, "cancelled", "reservation:cancel", input.reason);
    },

    async listByOrder(orderId: string) {
      return store.listReservationsByOrder(orderId);
    },

    async getReservation(id: string) {
      return store.getReservationById(id);
    },

    async listMovements(reservationId: string) {
      return store.listMovementsByReservation(reservationId);
    },
  };

  async function transitionTerminal(
    input: ReservationVersionedInput,
    ctx: ReservationWriteContext,
    to: "released" | "expired" | "cancelled",
    _action: string,
    reason: string,
  ): Promise<ReservationWriteResult> {
    const current = await store.getReservationById(input.reservationId);
    if (!current) throw new Error("Reservation not found");
    assertReservationTransition(current.reservationStatus, to);

    const releaseQty = roundQty(current.reservedQty - current.releasedQty);
    let updated: InventoryReservationRecord;
    try {
      updated = await store.updateReservationWithVersion(input.reservationId, input.expectedVersion, {
        reservationStatus: to,
        releasedQty: to === "released" || to === "cancelled" ? roundQty(current.releasedQty + releaseQty) : current.releasedQty,
        reservedQty: to === "released" || to === "cancelled" ? roundQty(current.reservedQty - releaseQty) : current.reservedQty,
      });
    } catch (e) {
      mapStaleError(e);
    }

    const movement = await appendMovement({
      movementType: movementTypeForTransition(current.reservationStatus, to),
      reservationId: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      quantity: releaseQty,
      sourceLocation: "reservation_hold",
      destinationLocation: "available",
      actorId: ctx.actorUserId,
      reasonCode: input.reasonCode ?? null,
      correlationId: ctx.correlationId,
      metadata: { reason },
    });

    const eventId = await appendReservationEvent(
      {
        eventType: statusToEventType(to, false) as AppendOperationalEventInput["eventType"],
        entityType: "inventory_reservation",
        entityId: updated.id,
        orderId: updated.orderId,
        title: `Reservation ${updated.reservationNumber} ${to}`,
        message: reason,
        correlationId: ctx.correlationId,
      },
      ctx,
    );
    return { reservation: updated, movementId: movement.id, eventId };
  }
}

export type ReservationRepository = ReturnType<typeof createReservationRepository>;
