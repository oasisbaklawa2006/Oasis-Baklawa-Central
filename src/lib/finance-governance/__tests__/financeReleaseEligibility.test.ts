import { describe, expect, it } from "vitest";
import { projectFinanceRelease } from "../financeReleaseEligibility";
import type { FinanceGovernanceInput } from "../financeGovernanceTypes";

const base: FinanceGovernanceInput = {
  orderId: "o1",
  orderValue: 100_000,
  advanceRequired: 30_000,
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

describe("financeReleaseEligibility", () => {
  it("commercially_released is not dispatch ready by itself", () => {
    const p = projectFinanceRelease(base);
    expect(p.releaseStatus).toBe("commercially_released");
    expect(p.dispatchFinanceSignal).toBe("ready");
    expect(p.warnings.some((w) => w.includes("dispatched"))).toBe(true);
  });

  it("blocks with finance holds", () => {
    const p = projectFinanceRelease({
      ...base,
      advanceVerified: false,
      openHoldTypes: ["advance_unverified"],
    });
    expect(p.dispatchFinanceSignal).toBe("blocked");
    expect(p.blockingReasons.length).toBeGreaterThan(0);
  });

  it("critical risk blocks commercial release", () => {
    const p = projectFinanceRelease({
      ...base,
      orderValue: 800_000,
      advanceVerified: false,
      creditApproved: false,
      reservationReady: false,
      dispatchReadinessGateEligible: false,
      complaintSeverity: "high",
      manualOverrideCount: 3,
      rejectionCount: 3,
      escalationCount: 4,
      openHoldTypes: ["risk_review_required", "commercial_dispute"],
    });
    expect(p.commercialRiskLevel).toBe("critical");
    expect(p.releaseStatus).toBe("commercially_blocked");
  });
});
