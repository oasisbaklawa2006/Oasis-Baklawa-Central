import { describe, expect, it } from "vitest";
import { deriveDispatchCompletionStatus } from "../dispatchCompletionEligibility";
import type { DispatchCompletionInput } from "../dispatchCompletionTypes";

const base: DispatchCompletionInput = {
  orderId: "o1",
  queueItemId: "q1",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  reservationReady: true,
  orderAlreadyDispatched: false,
  securityGatePassed: true,
  courierManifestAttached: true,
  openCompletionHolds: [],
};

describe("dispatchCompletionEligibility", () => {
  it("completion_eligible when 4B gate + 4C finance + manifest + gate", () => {
    expect(deriveDispatchCompletionStatus(base)).toBe("completion_eligible");
  });

  it("prerequisites_pending when readiness not gate_eligible", () => {
    expect(
      deriveDispatchCompletionStatus({ ...base, readinessStatus: "ready_for_review" }),
    ).toBe("prerequisites_pending");
  });

  it("blocked when completion holds open", () => {
    expect(
      deriveDispatchCompletionStatus({
        ...base,
        openCompletionHolds: ["supervisor_review_required"],
      }),
    ).toBe("completion_blocked");
  });

  it("already_dispatched terminal", () => {
    expect(deriveDispatchCompletionStatus({ ...base, orderAlreadyDispatched: true })).toBe(
      "already_dispatched",
    );
  });
});
