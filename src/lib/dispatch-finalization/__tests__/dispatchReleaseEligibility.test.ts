import { describe, expect, it } from "vitest";
import { deriveDispatchReleaseStatus } from "../dispatchReleaseEligibility";
import type { DispatchFinalizationInput } from "../dispatchFinalizationTypes";

const base: DispatchFinalizationInput = {
  orderId: "o1",
  currentOrderStatus: "cleared_for_dispatch",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  completionStatus: "completion_attested",
  reservationReady: true,
  transporterHandoffFinalized: true,
  gateReference: "gate-1",
  completionReference: "attest-1",
  transporterReference: "TP-99",
  openReleaseBlockers: [],
};

describe("dispatchReleaseEligibility", () => {
  it("release_ready when 4B+4C+4D chain satisfied", () => {
    expect(deriveDispatchReleaseStatus(base)).toBe("dispatch_release_ready");
  });

  it("pending when completion not attested", () => {
    expect(
      deriveDispatchReleaseStatus({ ...base, completionStatus: "completion_eligible" }),
    ).toBe("dispatch_release_pending");
  });

  it("blocked with explicit blockers", () => {
    expect(
      deriveDispatchReleaseStatus({ ...base, openReleaseBlockers: ["manual_hold"] }),
    ).toBe("dispatch_release_blocked");
  });
});
