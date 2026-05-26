import { describe, expect, it } from "vitest";
import { assertCanReserveQty, computeAvailableInventory } from "../reservationAvailability";
import { ReservationError } from "../reservationTypes";

describe("reservationAvailability", () => {
  const snap = {
    productId: "p1",
    sku: "SKU-1",
    physicalStock: 100,
    reservedOpen: 30,
    blockedInventory: 10,
    damagedInventory: 5,
    expiredInventory: 0,
    quarantineInventory: 0,
  };

  it("computes deterministic availability", () => {
    expect(computeAvailableInventory(snap)).toBe(55);
  });

  it("denies over reserve", () => {
    expect(() => assertCanReserveQty(snap, 60)).toThrow(ReservationError);
  });
});
