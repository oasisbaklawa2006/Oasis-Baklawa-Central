import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import {
  buildFinalPaymentPiCorrelationId,
  buildFinalPaymentPiIdempotencyKey,
  getFinalPaymentPiFacts,
  issueFinalPaymentPiRevision,
  parseFinalPaymentPiFacts,
  recordFinalPaymentPiDelivery,
} from "@/lib/order-authority/finalPaymentPiAuthorityClient";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

const digest = vi.fn(async () => new Uint8Array(32).buffer);

beforeAll(() => {
  vi.stubGlobal("crypto", { subtle: { digest } });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  rpc.mockReset();
  digest.mockClear();
});

describe("Core #178 final-payment PI authority client", () => {
  it("builds stable operation-scoped SHA-256 idempotency keys", async () => {
    const issueKey = await buildFinalPaymentPiIdempotencyKey("issue", "order:1");
    expect(issueKey).toMatch(/^central:fin-pay-pi:issue:[0-9a-f]{64}$/);
    expect(await buildFinalPaymentPiIdempotencyKey("issue", " order:1 ")).toBe(issueKey);
    expect(issueKey).not.toBe(await buildFinalPaymentPiIdempotencyKey("deliver", "order:1"));
  });

  it("reads governed final-payment PI facts and enforces invoice/payment separation", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        order_id: "order-1",
        available: true,
        final_payment_request_id: "req-1",
        pi_id: "pi-1",
        customer_visible_pi_number: "PI2026/09-0001",
        revision_number: 2,
        effective_status: "PAYMENT_DUE",
        finance_dpl_receipt_id: "dpl-1",
        commercial_version_id: "cv-1",
        final_payable_total: 12500,
        balance_due: 2500,
        settled: false,
        payment_action: "BANK_TRANSFER",
        payment_instructions: "Transfer to governed account",
        final_invoice_must_not_request_payment: true,
      },
      error: null,
    });
    const facts = await getFinalPaymentPiFacts("order-1");
    expect(facts.customerVisiblePiNumber).toBe("PI2026/09-0001");
    expect(facts.revisionNumber).toBe(2);
    expect(facts.balanceDue).toBe(2500);
    expect(facts.settled).toBe(false);
    expect(rpc).toHaveBeenCalledWith("get_sales_order_pi_final_payment_request_v1", { p_order_id: "order-1" });
  });

  it("fails closed when Core omits the invoice/payment separation flag", () => {
    expect(() => parseFinalPaymentPiFacts({ order_id: "order-1", available: false })).toThrow(
      "invoice/payment separation",
    );
  });

  it("issues DPL-bound final-payment PI revisions through canonical Core authority", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        final_payment_request_id: "req-1",
        revision_number: 1,
        customer_visible_pi_number: "PI2026/09-0001",
        final_payable_total: 12500,
        balance_due: 2500,
        already_issued: false,
      }],
      error: null,
    });
    const result = await issueFinalPaymentPiRevision({
      orderId: "order-1",
      piId: "pi-1",
      commercialVersionId: "cv-1",
      financeDplReceiptId: "dpl-1",
      documentReference: "storage:final-payment-pi.pdf",
      paymentAction: "BANK_TRANSFER",
      paymentInstructions: "Use the governed bank details",
      reason: "Finance DPL and frozen commercial terms verified",
      sourceChannel: "CENTRAL",
      sourceReference: "accounts-release",
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      actorId: "actor-1",
    });
    expect(result.revisionNumber).toBe(1);
    expect(result.balanceDue).toBe(2500);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("issue_sales_order_pi_final_payment_request_v1");
    expect(args).toMatchObject({
      p_order_id: "order-1",
      p_pi_id: "pi-1",
      p_commercial_version_id: "cv-1",
      p_finance_dpl_receipt_id: "dpl-1",
      p_document_reference: "storage:final-payment-pi.pdf",
      p_payment_action: "BANK_TRANSFER",
      p_actor_id: "actor-1",
    });
  });

  it("records governed M4 delivery evidence without browser-composed payment truth", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ delivery_id: "delivery-1", already_recorded: false }],
      error: null,
    });
    const result = await recordFinalPaymentPiDelivery({
      finalPaymentRequestId: "req-1",
      channel: "WHATSAPP",
      destinationReference: "+919999999999",
      deliveryStatus: "DELIVERED",
      evidenceReference: "provider:msg-1",
      deliveredAt: "2026-09-01T10:00:00.000Z",
      correlationId: "corr-2",
      idempotencyKey: "idem-2",
      actorId: "actor-1",
    });
    expect(result.deliveryId).toBe("delivery-1");
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("record_sales_order_pi_final_payment_delivery_v1");
    expect(args).not.toHaveProperty("p_final_payable_total");
    expect(args).not.toHaveProperty("p_dpl_snapshot");
  });

  it("exposes the exact merged Core #178 RPC surface", () => {
    const client = source("lib/order-authority/finalPaymentPiAuthorityClient.ts");
    expect(client).toContain("get_sales_order_pi_final_payment_request_v1");
    expect(client).toContain("issue_sales_order_pi_final_payment_request_v1");
    expect(client).toContain("record_sales_order_pi_final_payment_delivery_v1");
    expect(client).toContain("final_invoice_must_not_request_payment");
  });

  it("retires stale local PI generation and mutable final-balance truth from AdminOrders", () => {
    const adminOrders = source("pages/admin/AdminOrders.tsx");
    expect(adminOrders).not.toContain("generateProFormaInvoice");
    expect(adminOrders).not.toContain("invoiceGenerator");
    expect(adminOrders).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*document_stage:\s*["']PI["']/);
    expect(adminOrders).not.toMatch(/from\(["']orders["']\)\.update\(\{[^}]*payment_cleared:\s*true/);
  });

  it("binds Finance Exit to Core #178 before final invoice issuance", () => {
    const accountsRelease = source("pages/admin/AdminAccountsRelease.tsx");
    expect(accountsRelease).toContain("getFinalPaymentPiFacts");
    expect(accountsRelease).toContain("issueFinalPaymentPiRevision");
    expect(accountsRelease).toContain("PI requests final payment");
  });

  it("binds Buyer reads to Core #178 final-payment PI facts", () => {
    const buyerClient = source("lib/customerApp/customerAppClient.ts");
    const buyerApp = source("pages/customer/BuyerApp.tsx");
    expect(buyerClient).toContain("get_sales_order_pi_final_payment_request_v1");
    expect(buyerApp).toContain("finalPaymentPiFacts");
  });
});
