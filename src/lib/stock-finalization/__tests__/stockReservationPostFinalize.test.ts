import { describe, expect, it } from "vitest";
import { createInMemoryReservationServiceBundle } from "@/lib/inventory-reservations/reservationService";
import { createInMemoryReservationStore } from "@/lib/inventory-reservations/inMemoryReservationStore";
import { createReservationRepository } from "@/lib/inventory-reservations/reservationRepository";
import { createInMemoryOperationalEventRepository } from "@/lib/operational-events/inMemoryOperationalEventRepository";

describe("fulfillAfterStockConsumption", () => {
  it("sets fulfilled status with reserved_qty cleared", async () => {
    const store = createInMemoryReservationStore();
    const events = createInMemoryOperationalEventRepository();
    const repository = createReservationRepository({ store, events });

    const created = await repository.createReservation(
      {
        orderId: "order-1",
        productId: "prod-1",
        sku: "SKU-A",
        requestedQty: 5,
        sourceDepartment: "test",
      },
      {
        correlationId: "c1",
        actorUserId: "user-1",
        actorRole: "INVENTORY_MANAGER",
        actorDepartment: "test",
      },
    );

    await repository.reserveInventory(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reserveQty: 5,
        reason: "test",
      },
      {
        correlationId: "c2",
        actorUserId: "user-1",
        actorRole: "INVENTORY_MANAGER",
        actorDepartment: "test",
      },
      {
        productId: "prod-1",
        sku: "SKU-A",
        physicalStock: 100,
        reservedOpen: 0,
        blockedInventory: 0,
        damagedInventory: 0,
        expiredInventory: 0,
        quarantineInventory: 0,
      },
    );

    const current = await repository.getReservation(created.reservation.id);
    if (!current) throw new Error("missing reservation");

    const result = await repository.fulfillAfterStockConsumption(
      {
        reservationId: current.id,
        expectedVersion: current.version,
        consumedQty: 5,
        reasonCode: "stock_consumption_finalized",
      },
      {
        correlationId: "c3",
        actorUserId: "user-1",
        actorRole: "INVENTORY_MANAGER",
        actorDepartment: "stock_finalization",
      },
    );

    expect(result.reservation.reservationStatus).toBe("fulfilled");
    expect(result.reservation.reservedQty).toBe(0);
    expect(result.reservation.fulfilledQty).toBe(5);
  });
});
