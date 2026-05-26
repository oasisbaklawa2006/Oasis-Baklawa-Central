import { describe, expect, it } from "vitest";
import { projectDispatchReadiness } from "../dispatchReadinessProjection";
import type { DispatchReadinessInput } from "../dispatchReadinessTypes";

const baseInput: DispatchReadinessInput = {
  orderId: "00000000-0000-4000-8000-000000000101",
  queue: { queueItemId: "q-1", isActive: true, isCompleted: false, hasVersionConflict: false },
  scan: {
    hasUnresolvedMismatch: false,
    hasRejectedGateScan: false,
    gateScanVerified: true,
    cartonBarcodeVerified: true,
  },
  reservationStatus: "reserved",
  financeSignal: "ready",
  packingEvidenceVerified: true,
  documentPlaceholderPresent: true,
  openExceptionTypes: [],
};

describe("dispatchReadinessRules", () => {
  it("returns gate_eligible when all dimensions satisfied", () => {
    const p = projectDispatchReadiness(baseInput);
    expect(p.readinessStatus).toBe("gate_eligible");
    expect(p.gateEligibility).toBe("eligible_pending_review");
    expect(p.missingRequirements).toHaveLength(0);
  });

  it("blocks on missing packing evidence", () => {
    const p = projectDispatchReadiness({ ...baseInput, packingEvidenceVerified: false });
    expect(p.missingRequirements.some((m) => m.includes("packing"))).toBe(true);
    expect(p.readinessStatus).not.toBe("gate_eligible");
  });

  it("blocks on barcode mismatch", () => {
    const p = projectDispatchReadiness({
      ...baseInput,
      scan: { ...baseInput.scan, hasUnresolvedMismatch: true, cartonBarcodeVerified: false },
    });
    expect(p.openExceptions).toContain("dispatch_barcode_mismatch");
  });

  it("blocks on rejected gate scan", () => {
    const p = projectDispatchReadiness({
      ...baseInput,
      scan: { ...baseInput.scan, hasRejectedGateScan: true, gateScanVerified: false },
    });
    expect(p.openExceptions).toContain("dispatch_gate_rejected");
  });

  it("blocks on reservation not ready", () => {
    const p = projectDispatchReadiness({ ...baseInput, reservationStatus: "pending" });
    expect(p.openExceptions).toContain("dispatch_reservation_not_ready");
  });

  it("blocks on finance signal placeholder", () => {
    const p = projectDispatchReadiness({ ...baseInput, financeSignal: "blocked" });
    expect(p.openExceptions).toContain("dispatch_finance_signal_blocked");
  });

  it("blocks on stale queue version", () => {
    const p = projectDispatchReadiness({
      ...baseInput,
      queue: { ...baseInput.queue, hasVersionConflict: true },
    });
    expect(p.blockingReasons.some((b) => b.includes("version conflict"))).toBe(true);
  });
});
