import { describe, expect, it } from "vitest";
import {
  createInMemoryReservationServiceBundle,
  createReservationService,
} from "../reservationService";
import { ReservationError } from "../reservationTypes";

const ctx = {
  correlationId: "corr-1",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "SUPER_ADMIN",
};

describe("reservationRepository", () => {
  it("creates reservation with movement and event", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    const result = await svc.createReservation(
      {
        orderId: "00000000-0000-4000-8000-000000000010",
        productId: "00000000-0000-4000-8000-000000000020",
        sku: "SKU-A",
        requestedQty: 5,
      },
      ctx,
    );
    expect(result.reservation.reservationStatus).toBe("pending");
    const evts = await bundle._events.listByEntity("inventory_reservation", result.reservation.id);
    expect(evts.some((e) => e.eventType === "reservation_created")).toBe(true);
    expect(bundle._store._allMovements().length).toBe(1);
  });

  it("rejects stale version on reserve", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    const created = await svc.createReservation(
      {
        orderId: "00000000-0000-4000-8000-000000000010",
        productId: "00000000-0000-4000-8000-000000000020",
        sku: "SKU-A",
        requestedQty: 5,
      },
      ctx,
    );
    const availability = {
      productId: created.reservation.productId,
      sku: created.reservation.sku,
      physicalStock: 100,
      reservedOpen: 0,
      blockedInventory: 0,
      damagedInventory: 0,
      expiredInventory: 0,
      quarantineInventory: 0,
    };
    await svc.reserveInventory(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reserveQty: 5,
      },
      ctx,
      availability,
    );
    await expect(
      svc.releaseReservation(
        {
          reservationId: created.reservation.id,
          expectedVersion: created.reservation.version,
          reason: "retry after reserve",
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "stale_version" });
  });

  it("denies over-allocation", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    const created = await svc.createReservation(
      {
        orderId: "00000000-0000-4000-8000-000000000010",
        productId: "00000000-0000-4000-8000-000000000020",
        sku: "SKU-A",
        requestedQty: 5,
      },
      ctx,
    );
    const availability = {
      productId: created.reservation.productId,
      sku: created.reservation.sku,
      physicalStock: 100,
      reservedOpen: 0,
      blockedInventory: 0,
      damagedInventory: 0,
      expiredInventory: 0,
      quarantineInventory: 0,
    };
    await expect(
      svc.reserveInventory(
        {
          reservationId: created.reservation.id,
          expectedVersion: created.reservation.version,
          reserveQty: 10,
        },
        ctx,
        availability,
      ),
    ).rejects.toMatchObject({ code: "over_allocation" });
  });

  it("append-only ledger grows without update", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    await svc.createReservation(
      {
        orderId: "00000000-0000-4000-8000-000000000010",
        productId: "00000000-0000-4000-8000-000000000020",
        sku: "SKU-A",
        requestedQty: 2,
      },
      ctx,
    );
    const movements = bundle._store._allMovements();
    expect(movements.every((m) => m.movementType === "reservation_created")).toBe(true);
  });
});
