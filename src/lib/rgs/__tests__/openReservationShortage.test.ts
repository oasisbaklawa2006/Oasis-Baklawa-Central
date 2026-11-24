import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateOpenRgsReservationShortage } from "../openReservationShortage";

describe("RGS demand coverage after reservation release (Factory F09)", () => {
  it("does not subtract historical released_qty twice", () => {
    const amount = calculateOpenRgsReservationShortage({
      requested_qty: 10, reserved_qty: 8, fulfilled_qty: 0,
    });
    expect(amount).toBe(2);
  });

  it("reconciles partial fulfilment and zero outstanding demand", () => {
    expect(calculateOpenRgsReservationShortage({ requested_qty: 10, reserved_qty: 4, fulfilled_qty: 3 })).toBe(3);
    expect(calculateOpenRgsReservationShortage({ requested_qty: 10, reserved_qty: 8, fulfilled_qty: 2 })).toBe(0);
  });

  it("fails closed when Core returns an invalid or missing quantity", () => {
    expect(() => calculateOpenRgsReservationShortage({ requested_qty: null, reserved_qty: 2, fulfilled_qty: 0 }))
      .toThrow("missing requested_qty");
    expect(() => calculateOpenRgsReservationShortage({ requested_qty: 10, reserved_qty: "NaN", fulfilled_qty: 0 }))
      .toThrow("invalid reserved_qty");
  });

  it("binds ReadyGoodsStore allocation to the correct coverage helper", () => {
    const src = readFileSync(resolve(__dirname, "../../../pages/admin/ReadyGoodsStore.tsx"), "utf8");
    expect(src).toContain("calculateOpenRgsReservationShortage(reservation)");
    expect(src).not.toContain("Number(reservation?.released_qty");
  });
});
