import { describe, expect, it } from "vitest";
import { THREE_PGS_STORE_CODE, threePgsCommandCentreMetrics } from "@/pages/admin/ThreePgsCommandCentre";

describe("threePgsCommandCentreMetrics", () => {
  it("pins the command centre to the canonical 3PGS store code", () => {
    expect(THREE_PGS_STORE_CODE).toBe("3PGS");
  });

  it("composes stock, exception, procurement, P&A and GRN truth without inventing state", () => {
    const metrics = threePgsCommandCentreMetrics({
      balances: [
        {
          id: "b1",
          sku: "BOX-1",
          location_code: "3PGS",
          available_qty: 12,
          reserved_qty: 5,
          picked_qty: 1,
          damaged_qty: 2,
          expired_qty: 3,
          quarantine_qty: 4,
        },
      ],
      demand: [],
      procurement: [
        {
          id: "p1",
          requirement_number: "PR-1",
          sku: "BOX-1",
          destination_store_code: "3PGS",
          shortage_qty: 10,
          fulfilled_qty: 2,
          vendor_reference: null,
          expected_at: null,
          status: "open",
        },
        {
          id: "p2",
          requirement_number: "PR-2",
          sku: "BOX-2",
          destination_store_code: "3PGS",
          shortage_qty: 5,
          fulfilled_qty: 5,
          vendor_reference: "V-2",
          expected_at: null,
          status: "received",
        },
      ],
      assembly: [
        {
          id: "a1",
          requirement_number: "A-1",
          sku: "BOX-1",
          source_store_code: "3PGS",
          requested_qty: 4,
          fulfilled_qty: 1,
          status: "partially_fulfilled",
          priority: "urgent",
        },
      ],
      receipts: [
        { id: "r1", receipt_number: "R-1", destination_store_code: "3PGS", status: "accepted", created_at: "2026-09-01T00:00:00Z" },
        { id: "r2", receipt_number: "R-2", destination_store_code: "3PGS", status: "accepted", created_at: "2026-09-01T00:01:00Z" },
      ],
      grns: [
        { id: "g1", grn_number: "G-1", receipt_id: "r1", status: "finalised", finalised_at: "2026-09-01T00:02:00Z" },
      ],
    });

    expect(metrics).toEqual({
      available: 12,
      reserved: 5,
      exceptions: 9,
      openProcurement: 1,
      openAssembly: 1,
      receiptsAwaitingGrn: 1,
    });
  });

  it("does not count cancelled or rejected receipts as awaiting GRN", () => {
    const metrics = threePgsCommandCentreMetrics({
      balances: [],
      demand: [],
      procurement: [],
      assembly: [],
      receipts: [
        { id: "r1", receipt_number: "R-1", destination_store_code: "3PGS", status: "cancelled", created_at: "2026-09-01T00:00:00Z" },
        { id: "r2", receipt_number: "R-2", destination_store_code: "3PGS", status: "rejected", created_at: "2026-09-01T00:00:00Z" },
      ],
      grns: [],
    });

    expect(metrics.receiptsAwaitingGrn).toBe(0);
  });
});
