import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPaymentIdempotencyKey } from "../paymentAuthorityClient";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("PF-6A Central payment authority contract", () => {
  it("builds stable operation-scoped idempotency keys", () => {
    expect(buildPaymentIdempotencyKey("proof", "order:1")).toBe("central:pf6a:proof:order:1");
    expect(buildPaymentIdempotencyKey("proof", " order:1 ")).toBe("central:pf6a:proof:order:1");
    expect(buildPaymentIdempotencyKey("proof", "order:1")).not.toBe(buildPaymentIdempotencyKey("verify", "order:1"));
  });

  it("fails closed for an empty identity", () => {
    expect(() => buildPaymentIdempotencyKey("proof", "  ")).toThrow("stable payment identity");
  });

  it("exposes the exact merged Core RPC surface", () => {
    const client = source("lib/order-authority/paymentAuthorityClient.ts");
    expect(client).toContain("record_order_payment_proof_v1");
    expect(client).toContain("verify_order_payment_v1");
    expect(client).toContain("reject_order_payment_v1");
    expect(client).toContain("get_order_payment_facts_v1");
    expect(client).toContain("sales_order_proforma_invoice_authority_v1");
    expect(client).toContain("payment_facts_only");
  });

  it("removes direct PF-6A ledger writes and legacy finance decisions from migrated callers", () => {
    const adminFinance = source("pages/admin/AdminFinance.tsx");
    const accountsRelease = source("pages/admin/AdminAccountsRelease.tsx");
    const releaseBoard = source("pages/admin/FinanceReleaseBoard.tsx");
    expect(adminFinance).not.toMatch(/from\(["']order_payments["']\)[\s\S]{0,160}\.insert\(/);
    expect(accountsRelease).not.toMatch(/from\(["']order_payments["']\)[\s\S]{0,160}\.insert\(/);
    expect(releaseBoard).not.toMatch(/from\(["']order_payments["']\)/);
    expect(releaseBoard).toContain("verifyPayment");
    expect(releaseBoard).toContain("rejectPayment");
  });
});
