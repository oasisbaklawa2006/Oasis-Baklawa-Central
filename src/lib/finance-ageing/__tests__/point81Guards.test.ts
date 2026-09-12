import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { POINT81_CORE_PREREQUISITES } from "../financeAgeingContracts";

const ROOT = resolve(__dirname, "../../..");

describe("Point81 canonical closure guards", () => {
  it("documents precise Core prerequisites for ageing, exposure, CN/DN/refund, disputes", () => {
    expect(POINT81_CORE_PREREQUISITES.arAgeing.rpc).toBe("get_company_ar_ageing_facts_v1");
    expect(POINT81_CORE_PREREQUISITES.portfolioExposure.rpc).toBe("get_portfolio_exposure_facts_v1");
    expect(POINT81_CORE_PREREQUISITES.ledgerDisputeResolve.rpc).toBe("resolve_ledger_dispute_v1");
    expect(POINT81_CORE_PREREQUISITES.creditNoteIssue.rpc).toBe("issue_credit_note_v1");
    expect(POINT81_CORE_PREREQUISITES.debitNoteIssue.rpc).toBe("issue_debit_note_v1");
    expect(POINT81_CORE_PREREQUISITES.refundIssue.rpc).toBe("issue_refund_authority_v1");
  });

  it("LedgerDisputesPanel routes resolution through governed guard — no direct table UPDATE", () => {
    const panel = readFileSync(resolve(ROOT, "components/admin/LedgerDisputesPanel.tsx"), "utf8");
    expect(panel).toContain("resolveLedgerDispute");
    expect(panel).not.toMatch(/from\("ledger_disputes"\)\s*\.update/);
    expect(panel).not.toMatch(/from\("bi_monthly_ledgers"\)\s*\.update/);
  });

  it("CMDHeartbeat uses Core total_outstanding adaptor — not client unpaid order sums", () => {
    const heartbeat = readFileSync(resolve(ROOT, "pages/admin/CMDHeartbeat.tsx"), "utf8");
    expect(heartbeat).toContain("composePortfolioExposureFacts");
    expect(heartbeat).not.toMatch(/payment_status.*unpaid/);
  });

  it("creditWalletAuthorityClient binds exposure facts with exposure_facts_only guard", () => {
    const client = readFileSync(resolve(ROOT, "lib/order-authority/creditWalletAuthorityClient.ts"), "utf8");
    expect(client).toContain("get_credit_exposure_facts_v1");
    expect(client).toContain("exposure_facts_only");
  });

  it("customer statement normalizes CN/DN/refund fields from Core only", () => {
    const customer = readFileSync(resolve(ROOT, "lib/customerApp/customerAppClient.ts"), "utf8");
    expect(customer).toContain("credit_note_total");
    expect(customer).toContain("debit_note_total");
    expect(customer).toContain("refund_total");
    expect(customer).toContain("statement_facts_only");
  });
});
