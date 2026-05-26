import { describe, expect, it } from "vitest";
import { evaluateDispatchGateScan } from "../dispatchGateVerification";

const BASE = {
  entityType: "dispatch_gate",
  entityId: "00000000-0000-4000-8000-000000000020",
  gateId: "gate-a",
};

describe("dispatchGateVerification", () => {
  it("allows proceed when barcode matches", () => {
    const r = evaluateDispatchGateScan({
      ...BASE,
      barcodeValue: "GATE-1",
      expectedBarcode: "gate-1",
    });
    expect(r.allowedToProceed).toBe(true);
  });

  it("blocks proceed on mismatch without dispatch completion", () => {
    const r = evaluateDispatchGateScan({
      ...BASE,
      barcodeValue: "GATE-1",
      expectedBarcode: "GATE-2",
    });
    expect(r.allowedToProceed).toBe(false);
    expect(r.mismatchReason).toBeTruthy();
  });
});
