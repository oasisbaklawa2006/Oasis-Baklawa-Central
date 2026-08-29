import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPaymentCorrelationId,
  buildPaymentIdempotencyKey,
  parsePaymentBindingRows,
  parsePaymentFacts,
} from "../paymentAuthorityClient";

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
    expect(() => buildPaymentCorrelationId("proof", "  ")).toThrow("stable payment identity");
  });

  it("bounds correlation IDs and rejects ambiguous PI bindings", () => {
    const correlationId = buildPaymentCorrelationId("proof", "receipt:https://example.test/" + "x".repeat(5000));
    expect(correlationId.length).toBeLessThan(64);
    expect(() => parsePaymentBindingRows([])).toThrow("single governed PI");
    expect(() => parsePaymentBindingRows([{ id: "pi-1" }, { id: "pi-2" }])).toThrow("single governed PI");
  });

  it("maps the factual Core payment projection and fails closed on malformed rows", () => {
    const facts = parsePaymentFacts({
      payment_facts_only: true,
      pi_id: "pi-1",
      order_id: "order-1",
      commercial_version_id: "version-1",
      commercial_version_number: "2",
      commercial_value: "12500",
      verified_total: 2500,
      remaining_commercial_amount: 10000,
      payments: [{ payment_id: "payment-1", status: "uploaded", payment_type: "advance", submitted_amount: "2500" }],
    });
    expect(facts.payments[0]?.submittedAmount).toBe(2500);
    expect(() => parsePaymentFacts({ payment_facts_only: true, payments: [] })).toThrow("pi_id");
    expect(() => parsePaymentFacts({
      payment_facts_only: true,
      pi_id: "pi-1",
      order_id: "order-1",
      commercial_version_id: "version-1",
      commercial_version_number: 1,
      commercial_value: 100,
      verified_total: 0,
      remaining_commercial_amount: 100,
    })).toThrow("Invalid payments");
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
