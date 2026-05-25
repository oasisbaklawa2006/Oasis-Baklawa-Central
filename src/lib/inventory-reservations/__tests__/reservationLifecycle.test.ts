import { describe, expect, it } from "vitest";
import { isReservationStatusTransitionValid, statusAfterReserve } from "../reservationLifecycle";

describe("reservationLifecycle", () => {
  it("allows pending to reserved", () => {
    expect(isReservationStatusTransitionValid("pending", "reserved")).toBe(true);
  });

  it("denies fulfilled to reserved", () => {
    expect(isReservationStatusTransitionValid("fulfilled", "reserved")).toBe(false);
  });

  it("computes partial status", () => {
    expect(statusAfterReserve("pending", 10, 4)).toBe("partially_reserved");
    expect(statusAfterReserve("pending", 10, 10)).toBe("reserved");
  });
});
