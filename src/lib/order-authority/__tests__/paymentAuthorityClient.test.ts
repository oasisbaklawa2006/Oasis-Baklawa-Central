import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPaymentCorrelationId,
  buildPaymentIdempotencyKey,
  buildPaymentProofIdentity,
  parsePaymentBindingRows,
  parsePaymentFacts,
} from "../paymentAuthorityClient";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("PF-6A Central payment authority contract", () => {
  it("builds stable operation-scoped SHA-256 idempotency keys", async () => {
    const proofKey = await buildPaymentIdempotencyKey("proof", "order:1");
    expect(proofKey).toMatch(/^central:pf6a:proof:[0-9a-f]{64}$/);
    expect(await buildPaymentIdempotencyKey("proof", " order:1 ")).toBe(proofKey);
    expect(proofKey).not.toBe(await buildPaymentIdempotencyKey("verify", "order:1"));
  });

  it("fails closed for an empty identity", async () => {
    await expect(buildPaymentIdempotencyKey("proof", "  ")).rejects.toThrow("stable payment identity");
    await expect(buildPaymentCorrelationId("proof", "  ")).rejects.toThrow("stable payment identity");
  });

  it("uses a deterministic collision-resistant digest and bounds correlation IDs", async () => {
    const base = {
      orderId: "order-1",
      piId: "pi-1",
      commercialVersionId: "version-1",
      paymentType: "advance" as const,
      submittedAmount: 2500,
      currency: "INR",
      paymentMode: "UPI",
      externalReference: "utr-1",
      payerReference: "payer-1",
      proofEvidenceReference: "https://example.test/" + "x".repeat(5000),
      sourceChannel: "WHATSAPP",
      sourceReference: "draft-1",
    };
    const identity = buildPaymentProofIdentity(base);
    const correlationId = await buildPaymentCorrelationId("proof", identity);
    expect(correlationId).toMatch(/^central:pf6a:proof:[0-9a-f]{64}$/);
    expect(correlationId).toHaveLength(83);
    expect(await buildPaymentCorrelationId("proof", identity)).toBe(correlationId);
    expect(await buildPaymentIdempotencyKey("proof", identity)).toMatch(/^central:pf6a:proof:[0-9a-f]{64}$/);
    expect(await buildPaymentIdempotencyKey("proof", identity)).toHaveLength(83);
    expect(await buildPaymentCorrelationId("proof", buildPaymentProofIdentity({ ...base, proofEvidenceReference: "receipt-2" }))).not.toBe(correlationId);
    expect(await buildPaymentIdempotencyKey("proof", buildPaymentProofIdentity({ ...base, proofEvidenceReference: "receipt-2" }))).not.toBe(await buildPaymentIdempotencyKey("proof", identity));
    expect(await buildPaymentCorrelationId("verify", "payment-1")).toMatch(/^central:pf6a:verify:[0-9a-f]{64}$/);
    expect(await buildPaymentCorrelationId("reject", "payment-1")).not.toBe(await buildPaymentCorrelationId("verify", "payment-1"));
    const client = source("lib/order-authority/paymentAuthorityClient.ts");
    expect(client).not.toContain("2166136261");
    expect(client).not.toContain("Math.imul");
    expect(client).not.toContain("padStart(8, \"0\")");
  });

  it("rejects ambiguous PI bindings", () => {
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

  it("keeps payment verification separate from production and operations mutation", () => {
    const adminFinance = source("pages/admin/AdminFinance.tsx");
    const releaseBoard = source("pages/admin/FinanceReleaseBoard.tsx");
    const paymentVerification = adminFinance.slice(
      adminFinance.indexOf("const handleFinancialEntrySubmit"),
      adminFinance.indexOf("// Short-Term Credit Release"),
    );
    const paymentReview = releaseBoard.slice(
      releaseBoard.indexOf("const runVerifyAction"),
      releaseBoard.indexOf("const pushToFloor"),
    );
    expect(paymentVerification).toContain("verifyPayment");
    expect(paymentVerification).not.toContain("releaseOrderToManufacturing");
    expect(paymentVerification).not.toContain("order_items");
    expect(paymentVerification).not.toContain("production_status");
    expect(paymentVerification).not.toContain("BOM_EXPLOSION");
    expect(paymentReview).not.toMatch(/releaseOrderTo(InProduction|Manufacturing)|order_items|production_status|BOM_EXPLOSION/);
  });
});
