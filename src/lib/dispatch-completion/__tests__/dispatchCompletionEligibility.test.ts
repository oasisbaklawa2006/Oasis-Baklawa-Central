import { describe, expect, it } from "vitest";
import {
  buildCompletionBlockingReasons,
  deriveDispatchCompletionStatus,
} from "../dispatchCompletionEligibility";
import type { DispatchCompletionInput } from "../dispatchCompletionTypes";

const base: DispatchCompletionInput = {
  orderId: "00000000-0000-4000-8000-000000000301",
  queueItemId: null,
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  reservationReady: false,
  orderAlreadyDispatched: false,
  securityGatePassed: true,
  courierManifestAttached: true,
  openCompletionHolds: [],
};

describe("dispatchCompletionEligibility — pre_dispatch_wizard", () => {
  it("allows completion_eligible without reservation when policy is pre_dispatch_wizard", () => {
    const input: DispatchCompletionInput = {
      ...base,
      completionPolicy: "pre_dispatch_wizard",
    };
    expect(deriveDispatchCompletionStatus(input)).toBe("completion_eligible");
    expect(buildCompletionBlockingReasons(input)).not.toContain("Inventory reservation not ready");
  });

  it("still requires reservation under full policy", () => {
    expect(deriveDispatchCompletionStatus(base)).toBe("prerequisites_pending");
    expect(buildCompletionBlockingReasons(base)).toContain("Inventory reservation not ready");
  });
});
