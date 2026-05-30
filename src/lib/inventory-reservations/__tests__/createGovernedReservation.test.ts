import { describe, expect, it } from "vitest";
import {
  createInMemoryReservationServiceBundle,
  createReservationService,
} from "../reservationService";
import { buildAvailabilitySnapshotFromBalance } from "../buildAvailabilitySnapshot";

const ctx = {
  correlationId: "test-4f",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "SUPER_ADMIN",
};

/** Mirrors createAndReserveInventoryForOrder without Supabase. */
describe("governed create + reserve flow", () => {
  it("creates reservation_created movement then reserve movement", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    const created = await svc.createReservation(
      {
        orderId: "d6c79498-cde9-4394-b4d0-7b56d5371e85",
        productId: "36e01155-1a03-47d8-991d-e4198ddc6d94",
        sku: "S12-GOLDEN-001",
        requestedQty: 4,
        sourceDepartment: "reservation_board",
      },
      ctx,
    );
    expect(created.reservation.reservationStatus).toBe("pending");
    const snapshot = buildAvailabilitySnapshotFromBalance({
      productId: created.reservation.productId,
      sku: created.reservation.sku,
      balance: { availableQty: 50, reservedQty: 0 },
      openReservedQty: 0,
    });
    const reserved = await svc.reserveInventory(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reserveQty: 4,
      },
      ctx,
      snapshot,
    );
    expect(reserved.reservation.reservationStatus).toBe("reserved");
    expect(reserved.reservation.reservedQty).toBe(4);
    const movements = bundle._store._allMovements();
    expect(movements.some((m) => m.movementType === "reservation_created")).toBe(true);
    expect(movements.length).toBeGreaterThanOrEqual(2);
  });
});
