import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Point 80 finance hold/release surface guard", () => {
  it("FinanceGovernanceBoard routes writes through financeHoldReleaseAuthorityClient only", () => {
    const page = source("src/pages/admin/FinanceGovernanceBoard.tsx");
    expect(page).toContain("executeFinanceControlWrite");
    expect(page).toContain("assertCommercialHoldReleaseCoreAvailable");
    expect(page).toContain("COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE");
    expect(page).not.toContain("bundle.service.commercialRelease");
    expect(page).not.toContain("bundle.service.startReview");
    expect(page).not.toContain("bundle.service.placeHold");
    expect(page).not.toContain("bundle.service.releaseHold");
  });

  it("finance-governance service remains projection-only and is not imported by FinanceReleaseBoard", () => {
    const releaseBoard = source("src/pages/admin/FinanceReleaseBoard.tsx");
    expect(releaseBoard).toContain("verifyPayment");
    expect(releaseBoard).toContain("releaseOrderToInProduction");
    expect(releaseBoard).not.toContain("createFinanceGovernanceService");
    expect(releaseBoard).not.toContain("finance_review_evidence");
  });

  it("AdminFinance restore_order_financials remains a legacy repair path outside Point 80 canonical control", () => {
    const page = source("src/pages/admin/AdminFinance.tsx");
    expect(page).toContain('supabase.rpc("restore_order_financials"');
    expect(page).not.toContain("executeFinanceControlWrite");
  });

  it("order authority still gates production release through PF-6C clearance", () => {
    const authority = source("src/lib/order-authority/orderAuthorityClient.ts");
    expect(authority).toContain("ensureFinanceOperationsClearance");
    expect(authority).toContain("decideFinanceOperationsClearance");
  });
});
