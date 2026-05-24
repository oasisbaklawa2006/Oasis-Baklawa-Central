import { describe, expect, it } from "vitest";
import {
  buildCartonLabelPayload,
  buildReservationLabelPayload,
} from "@/lib/barcode/barcodePayloads";

describe("barcode payloads", () => {
  it("builds deterministic reservation payload keys (qty as display string only)", () => {
    const a = buildReservationLabelPayload({
      reservationId: "res-1",
      customerName: "A",
      storeName: "S",
      productLabel: "P",
      qtyDisplay: "3",
      pickupDisplay: "tomorrow 10am",
    });
    const b = buildReservationLabelPayload({
      reservationId: "res-1",
      customerName: "A",
      storeName: "S",
      productLabel: "P",
      qtyDisplay: "3",
      pickupDisplay: "tomorrow 10am",
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.qtyDisplay).toBe("3");
    expect((a as { disclaimer?: string }).disclaimer).toMatch(/not guaranteed/);
  });

  it("does not embed live stock counts in carton payload", () => {
    const p = buildCartonLabelPayload({
      cartonId: "c1",
      destinationLabel: "X",
      lineItemsSummary: "operator text only",
    });
    expect(p).not.toHaveProperty("quantity");
    expect(p).not.toHaveProperty("stock");
    expect(p.lineItemsSummary).toBe("operator text only");
  });
});
