import { describe, expect, it } from "vitest";
import { detectFinanceHolds, holdBlocksCommercialRelease } from "../financeHoldRules";
import type { FinanceGovernanceInput } from "../financeGovernanceTypes";

describe("financeHoldRules", () => {
  it("detects advance unverified hold", () => {
    const input: FinanceGovernanceInput = {
      orderId: "o1",
      orderValue: 50_000,
      advanceRequired: 10_000,
      advanceVerified: false,
      creditApproved: true,
      openHoldTypes: [],
      reservationReady: true,
      dispatchReadinessGateEligible: false,
      complaintSeverity: "none",
      staleFinanceReview: false,
      manualOverrideCount: 0,
      rejectionCount: 0,
      escalationCount: 0,
    };
    const holds = detectFinanceHolds(input);
    expect(holds).toContain("advance_unverified");
    expect(holdBlocksCommercialRelease(holds)).toBe(true);
  });
});
