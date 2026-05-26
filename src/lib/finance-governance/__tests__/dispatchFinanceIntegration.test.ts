import { describe, expect, it } from "vitest";
import { resolveDispatchFinanceSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { projectFinanceRelease } from "../financeReleaseEligibility";
import type { FinanceGovernanceInput } from "../financeGovernanceTypes";

describe("dispatch finance integration", () => {
  it("derives ready signal from commercially released governance", () => {
    const input: FinanceGovernanceInput = {
      orderId: "o1",
      orderValue: 80_000,
      advanceRequired: 20_000,
      advanceVerified: true,
      creditApproved: true,
      openHoldTypes: [],
      reservationReady: true,
      dispatchReadinessGateEligible: true,
      complaintSeverity: "none",
      staleFinanceReview: false,
      manualOverrideCount: 0,
      rejectionCount: 0,
      escalationCount: 0,
    };
    const projection = projectFinanceRelease(input);
    expect(resolveDispatchFinanceSignal(input)).toBe("ready");
    expect(projection.releaseStatus).toBe("commercially_released");
  });

  it("blocked signal when holds present", () => {
    const input: FinanceGovernanceInput = {
      orderId: "o2",
      orderValue: 80_000,
      advanceRequired: 20_000,
      advanceVerified: false,
      creditApproved: false,
      openHoldTypes: ["advance_unverified"],
      reservationReady: false,
      dispatchReadinessGateEligible: false,
      complaintSeverity: "low",
      staleFinanceReview: false,
      manualOverrideCount: 0,
      rejectionCount: 0,
      escalationCount: 0,
    };
    expect(resolveDispatchFinanceSignal(input)).toBe("blocked");
  });
});
