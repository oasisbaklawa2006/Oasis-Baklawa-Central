import { describe, expect, it } from "vitest";
import {
  evaluateStockDeductionEligibility,
  isDispatchFinalizedForStock,
} from "../stockDeductionEligibility";
import type { StockFinalizationInput } from "../stockFinalizationTypes";
import type { StockReservationRecord } from "../stockReservationTypes";

const reservation: StockReservationRecord = {
  id: "res-1",
  reservationNumber: "RSV-001",
  orderId: "ord-1",
  productId: "prod-1",
  sku: "SKU-A",
  requestedQty: 10,
  reservedQty: 10,
  fulfilledQty: 0,
  releasedQty: 0,
  reservationStatus: "reserved",

};

const base: StockFinalizationInput = {
  orderId: "ord-1",
  orderStatus: "dispatched",
  dispatchReleaseStatus: "dispatch_finalized",
  reservations: [reservation],
  scanReference: "scan-1",
  gateReference: "gate-1",
  dispatchLineageId: "drl-1",
  locationCode: "WH-MAIN",
};

describe("stockDeductionEligibility", () => {
  it("requires dispatch_finalized and dispatched status", () => {
    expect(isDispatchFinalizedForStock("dispatch_finalized", "dispatched")).toBe(true);
    expect(isDispatchFinalizedForStock("dispatch_release_ready", "dispatched")).toBe(false);
    expect(isDispatchFinalizedForStock("dispatch_finalized", "cleared_for_dispatch")).toBe(false);
  });

  it("blocks deduction before dispatch finalization", () => {
    const result = evaluateStockDeductionEligibility({
      ...base,
      dispatchReleaseStatus: "dispatch_release_ready",
      orderStatus: "cleared_for_dispatch",
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("dispatch_not_finalized");
  });

  it("blocks without scan evidence", () => {
    const result = evaluateStockDeductionEligibility({ ...base, scanReference: null });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("scan_evidence_required");
  });

  it("allows when finalized with consumable reservation", () => {
    const result = evaluateStockDeductionEligibility(base);
    expect(result.eligible).toBe(true);
  });
});
