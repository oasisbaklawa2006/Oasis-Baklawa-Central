import { describe, expect, it } from "vitest";
import { deriveReservationReadinessForOrder } from "../reservationReadinessFusion";

describe("deriveReservationReadinessForOrder", () => {
  it("returns none when no reservations", () => {
    expect(deriveReservationReadinessForOrder([])).toEqual({
      reservationStatus: "none",
      reservationReady: false,
    });
  });

  it("returns ready for reserved status", () => {
    expect(deriveReservationReadinessForOrder(["reserved"])).toEqual({
      reservationStatus: "reserved",
      reservationReady: true,
    });
  });

  it("returns blocked when any reservation blocked", () => {
    expect(deriveReservationReadinessForOrder(["reserved", "blocked"])).toEqual({
      reservationStatus: "blocked",
      reservationReady: false,
    });
  });

  it("returns pending when only pending rows", () => {
    expect(deriveReservationReadinessForOrder(["pending"])).toEqual({
      reservationStatus: "pending",
      reservationReady: false,
    });
  });
});
