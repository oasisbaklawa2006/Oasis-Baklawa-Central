import { describe, expect, it } from "vitest";
import { assertReservationUpdateAffected } from "../reservationConcurrency";
import {
  validateAllocationInsert,
  validateInventoryMovementInsert,
} from "../supabaseInventoryReservationStore";
import { ReservationError } from "../reservationTypes";
import { RESERVATION_AVAILABILITY_SOURCES_PENDING } from "../reservationService";
import { createInMemoryReservationStore } from "../inMemoryReservationStore";
import type { InventoryReservationStore } from "../reservationStoreContract";

describe("supabaseInventoryReservationStore validations", () => {
  it("rejects deduct_stock movement type", () => {
    expect(() =>
      validateInventoryMovementInsert({
        movementType: "deduct_stock" as never,
        correlationId: "c",
        productId: "p",
        sku: "S",
        quantity: 1,
      }),
    ).toThrow(/Disallowed inventory movement type/);
  });

  it("requires correlation_id on movement", () => {
    expect(() =>
      validateInventoryMovementInsert({
        movementType: "reservation_created",
        correlationId: "",
        productId: "p",
        sku: "S",
        quantity: 1,
      }),
    ).toThrow(/correlation_id/);
  });

  it("rejects non-positive allocation qty", () => {
    expect(() =>
      validateAllocationInsert({ allocatedQty: 0, allocationStatus: "active" }),
    ).toThrow(/positive/);
  });

  it("throws stale_version when no row updated", () => {
    try {
      assertReservationUpdateAffected(0, 3);
      expect.fail("expected stale_version");
    } catch (err) {
      expect(err).toBeInstanceOf(ReservationError);
      expect((err as ReservationError).code).toBe("stale_version");
    }
  });

  it("documents no silent stock table reads", () => {
    expect(RESERVATION_AVAILABILITY_SOURCES_PENDING).toContain("physical_stock");
    expect(RESERVATION_AVAILABILITY_SOURCES_PENDING).not.toContain("inventory_stock");
  });
});

describe("reservation store contract (in-memory parity)", () => {
  const store: InventoryReservationStore = createInMemoryReservationStore();

  it("updateReservationWithVersion rejects stale version", async () => {
    const row = await store.createReservationRow({
      id: crypto.randomUUID(),
      reservationNumber: "RES-T",
      orderId: "00000000-0000-4000-8000-000000000010",
      queueItemId: null,
      customerId: null,
      productId: "00000000-0000-4000-8000-000000000020",
      sku: "SKU-T",
      requestedQty: 5,
      reservedQty: 0,
      fulfilledQty: 0,
      releasedQty: 0,
      reservationStatus: "pending",
      reservationPriority: "normal",
      sourceDepartment: null,
      reservedBy: null,
      approvedBy: null,
      expiresAt: null,
      notes: null,
      correlationId: "c",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.updateReservationWithVersion(row.id, 1, { reservationStatus: "reserved" });
    await expect(
      store.updateReservationWithVersion(row.id, 1, { reservationStatus: "cancelled" }),
    ).rejects.toThrow(/Stale reservation version/);
  });

  it("insertInventoryMovement returns record with id", async () => {
    const m = await store.insertInventoryMovement({
      movementType: "inventory_hold",
      reservationId: null,
      productId: "p",
      sku: "S",
      quantity: 2,
      sourceLocation: null,
      destinationLocation: "hold",
      actorId: null,
      reasonCode: null,
      correlationId: "corr",
      metadata: {},
    });
    expect(m.id).toBeTruthy();
    expect(m.movementType).toBe("inventory_hold");
  });
});
