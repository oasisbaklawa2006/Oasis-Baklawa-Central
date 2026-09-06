import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Point 80 finance control surface guard", () => {
  it("FinanceGovernanceBoard surfaces Core prerequisite when writes are blocked", () => {
    const board = source("src/pages/admin/FinanceGovernanceBoard.tsx");
    expect(board).toContain("corePrerequisiteMessage");
    expect(board).toContain("bundle?.canExecuteWrites");
  });

  it("finance governance bundle fail-closes on missing Core PF-6D authority", () => {
    const bundle = source("src/lib/finance-governance/createFinanceGovernanceBundle.ts");
    expect(bundle).toContain("resolveFinanceControlBoundary");
    expect(bundle).toContain('persistenceMode: "blocked"');
    expect(bundle).toContain("corePrerequisiteMessage");
    expect(bundle).not.toContain('canExecuteWrites: true,\n      corePrerequisiteMessage: null,\n    };\n  }\n\n  return {\n    service: createFinanceGovernanceService({\n      evidence: createSupabaseFinanceEvidenceStore(client)');
  });

  it("finance governance service routes hold/release/commercial release through Core boundary", () => {
    const service = source("src/lib/finance-governance/financeGovernanceService.ts");
    expect(service).toContain("assertCoreWriteAuthority");
    expect(service).toContain("placeFinanceHold");
    expect(service).toContain("releaseFinanceHold");
    expect(service).toContain("decideFinanceOperationsClearance");
    expect(service).toContain("hold_event_id from Core finance control facts");
    expect(service).toContain('"core_prerequisite"');
  });

  it("FinanceReleaseBoard keeps payment verification separate from hold/release authority", () => {
    const board = source("src/pages/admin/FinanceReleaseBoard.tsx");
    expect(board).toContain("verifyPayment");
    expect(board).toContain("releaseOrderToInProduction");
    expect(board).not.toContain("placeFinanceHold");
    expect(board).not.toMatch(/from\(["']finance_review_evidence["']\)[\s\S]{0,80}\.insert\(/);
  });

  it("AdminFinance does not recreate direct finance_review_evidence writes", () => {
    const page = source("src/pages/admin/AdminFinance.tsx");
    expect(page).not.toMatch(/from\(["']finance_review_evidence["']\)[\s\S]{0,80}\.insert\(/);
  });

  it("FinanceReleaseBoard does not bypass dual-control clearance with legacy verification RPC", () => {
    const board = source("src/pages/admin/FinanceReleaseBoard.tsx");
    expect(board).not.toContain("updateOrderFinanceVerification");
    expect(board).toContain("verifyPayment");
  });
});
