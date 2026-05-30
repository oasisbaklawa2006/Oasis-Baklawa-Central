import { describe, expect, it } from "vitest";
import {
  createInMemoryReservationServiceBundle,
  createReservationService,
} from "../reservationService";
import { buildAvailabilitySnapshotFromBalance } from "../buildAvailabilitySnapshot";
import { ReservationError } from "../reservationTypes";
import { isReservationOpen } from "../reservationLifecycle";

const ctx = {
  correlationId: "test-comp",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "SUPER_ADMIN",
};

describe("reserve failure compensation", () => {
  it("cancels pending reservation when reserve fails", async () => {
    const bundle = createInMemoryReservationServiceBundle();
    const svc = createReservationService(bundle);
    const created = await svc.createReservation(
      {
        orderId: "d6c79498-cde9-4394-b4d0-7b56d5371e85",
        productId: "p1",
        sku: "SKU-A",
        requestedQty: 5,
      },
      ctx,
    );
    const snapshot = buildAvailabilitySnapshotFromBalance({
      productId: "p1",
      sku: "SKU-A",
      balance: { availableQty: 1, reservedQty: 0 },
      openReservedQty: 0,
    });
    await expect(
      svc.reserveInventory(
        {
          reservationId: created.reservation.id,
          expectedVersion: created.reservation.version,
          reserveQty: 5,
        },
        ctx,
        snapshot,
      ),
    ).rejects.toBeInstanceOf(ReservationError);

    await svc.cancelReservation(
      {
        reservationId: created.reservation.id,
        expectedVersion: created.reservation.version,
        reason: "test cleanup",
      },
      ctx,
    );
    const row = await svc.getReservation(created.reservation.id);
    expect(row?.reservationStatus).toBe("cancelled");
    expect(isReservationOpen(row!.reservationStatus)).toBe(false);
  });
});
