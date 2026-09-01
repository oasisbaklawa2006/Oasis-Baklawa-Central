import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCreditRequestIdentity,
  buildCreditWalletCorrelationId,
  buildCreditWalletIdempotencyKey,
  buildWalletIdentity,
  parseCreditExposureFacts,
} from "../creditWalletAuthorityClient";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

const digest = vi.fn(async () => new Uint8Array(32).buffer);

beforeAll(() => {
  vi.stubGlobal("crypto", { subtle: { digest } });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => digest.mockClear());

describe("PF-6B Central credit, wallet and exposure authority contract", () => {
  const wallet = {
    companyId: "company-1",
    direction: "credit" as const,
    amount: 1250,
    currency: "INR",
    orderId: "order-1",
    proformaInvoiceId: "pi-1",
    commercialVersionId: "version-1",
    sourceChannel: "CENTRAL_FINANCE",
    sourceReference: "return-1",
    reason: "Approved return",
  };

  it("builds bounded deterministic identities and rejects invalid amounts", async () => {
    const identity = buildWalletIdentity(wallet);
    expect(await buildCreditWalletIdempotencyKey("wallet", identity)).toMatch(/^central:pf6b:wallet:[0-9a-f]{64}$/);
    expect(await buildCreditWalletCorrelationId("wallet", identity)).toHaveLength(84);
    const longIdentity = "full-identity:" + "x".repeat(5000);
    expect(await buildCreditWalletIdempotencyKey("wallet", longIdentity)).toMatch(/^central:pf6b:wallet:[0-9a-f]{64}$/);
    expect(await buildCreditWalletCorrelationId("wallet", longIdentity)).toMatch(/^central:pf6b:wallet:[0-9a-f]{64}$/);
    await expect(buildCreditWalletIdempotencyKey("wallet", "  ")).rejects.toThrow("stable PF-6B identity");
    expect(buildWalletIdentity(wallet)).toBe(identity);
    expect(() => buildWalletIdentity({ ...wallet, amount: 0 })).toThrow("positive finite amount");
    expect(() => buildCreditRequestIdentity({
      companyId: "company-1", orderId: "order-1", proformaInvoiceId: "pi-1", commercialVersionId: "version-1",
      creditType: "short_term_so", requestedAmount: Number.NaN, sourceChannel: "CENTRAL_FINANCE",
      sourceReference: "request-1", reason: "Need credit", expiresAt: null,
    })).toThrow("positive finite amount");
  });

  it("parses factual exposure only and fails closed on clearance or missing binding", () => {
    const facts = parseCreditExposureFacts({
      company_id: "company-1", order_id: "order-1", pi_id: "pi-1", commercial_version_id: "version-1",
      commercial_version_number: 2, commercial_value: 10000, verified_payment_total: 3000,
      wallet_balance: 500, approved_short_term_credit: 2000, approved_long_term_credit: 0,
      proven_obligation_total: 2000, payment_facts: {}, facts_as_of: new Date().toISOString(),
      exposure_facts_only: true, clearance_decision: null,
    });
    expect(facts.exposure_facts_only).toBe(true);
    expect(facts.clearance_decision).toBeNull();
    expect(() => parseCreditExposureFacts({ exposure_facts_only: true, clearance_decision: "CLEARED" })).toThrow();
    expect(() => parseCreditExposureFacts({ exposure_facts_only: true, clearance_decision: null, company_id: "company-1" })).toThrow();
  });

  it("exposes the exact merged Core PF-6B RPC surface", () => {
    const client = source("lib/order-authority/creditWalletAuthorityClient.ts");
    expect(client).toContain("record_wallet_entry_v1");
    expect(client).toContain("get_wallet_balance_v1");
    expect(client).toContain("request_credit_authority_v1");
    expect(client).toContain("decide_credit_request_v1");
    expect(client).toContain("get_credit_exposure_facts_v1");
    expect(client).toContain("exposure_facts_only");
    expect(client).toContain("clearance_decision: null");
    expect(client).not.toContain('from("wallet_transactions").insert');
    expect(client).not.toContain('from("credit_requests").insert');
  });

  it("removes direct PF-6B mutations and credit-to-release coupling from migrated callers", () => {
    const adminFinance = source("pages/admin/AdminFinance.tsx");
    const packing = source("pages/admin/AdminPackingDispatch.tsx");
    const accounts = source("pages/admin/AdminAccountsRelease.tsx");
    const modal = source("components/CreditRequestModal.tsx");
    const releaseBoard = source("pages/admin/FinanceReleaseBoard.tsx");
    for (const migrated of [adminFinance, packing, accounts, modal]) {
      expect(migrated).not.toMatch(/from\(["']companies["']\)[\s\S]{0,220}\.update\([\s\S]{0,220}wallet_balance/);
      expect(migrated).not.toMatch(/from\(["']wallet_transactions["']\)[\s\S]{0,80}\.insert\(/);
      expect(migrated).not.toMatch(/from\(["']credit_requests["']\)[\s\S]{0,80}\.(insert|update)\(/);
    }
    const shortTerm = adminFinance.slice(adminFinance.indexOf("const handleShortTermCredit"), adminFinance.indexOf("// DPL Calculation"));
    expect(shortTerm).toContain("requestCredit");
    expect(shortTerm).toContain("resolveCreditBinding");
    expect(shortTerm).not.toContain("releaseOrderToManufacturing");
    const decision = adminFinance.slice(adminFinance.indexOf("const handleCreditAction"), adminFinance.indexOf("const handleReturnApproval"));
    expect(decision).toContain("decideCreditRequest");
    expect(decision).not.toContain("credit_limit");
    expect(releaseBoard).not.toContain("updateOrderFinanceVerification");
    expect(releaseBoard).not.toContain("Approve Credit");
    const salesDashboard = source("pages/sales/SalesDashboard.tsx");
    expect(salesDashboard).toContain("getWalletBalance");
    expect(salesDashboard).toContain('wallet_balance: null');
    expect(salesDashboard).not.toContain("wallet_balance || 0");

    expect(accounts).toContain("getFinanceExitFacts");
    expect(accounts).toContain("facts?.settlement");
    expect(accounts).not.toContain("getWalletBalance");
    expect(accounts).not.toContain("wallet_balance ?? 0");
  });

  it("keeps company-level credit-limit administration explicitly outside PF-6B", () => {
    const adminClients = source("pages/admin/AdminClients.tsx");
    expect(adminClients).toContain("credit_limit: editCreditLimit");
    expect(adminClients).toContain("Directory Logic");
    expect(source("pages/sales/SalesDashboard.tsx")).toContain("Select a governed SO to request credit");
  });
});
