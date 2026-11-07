import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalSupportIssueType,
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
  clearGeneralQueryIdempotencyKey,
  getGeneralQueryIdempotencyKey,
  getLocalDateInputValue,
  normalizeBuyerFinanceFacts,
  normalizeBuyerFinalPaymentPiFacts,
  normalizeBuyerGeneralQuery,
  normalizeBuyerCheckoutQuote,
  normalizeBuyerStatement,
  draftCartMatchesCheckoutQuote,
  isCheckoutQuoteFingerprint,
} from "./customerAppClient";

describe("customer checkout idempotency", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearCheckoutIdempotencyKey();
  });

  it("reuses one key across lost-response retries", () => {
    const first = getCheckoutIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getCheckoutIdempotencyKey()).toBe(first);
  });

  it("rotates only after a successful submission clears the key", () => {
    const first = getCheckoutIdempotencyKey();
    clearCheckoutIdempotencyKey();
    expect(getCheckoutIdempotencyKey()).not.toBe(first);
  });

  it("uses the local calendar date for the dispatch-date minimum", () => {
    expect(getLocalDateInputValue(new Date(2026, 7, 31, 23, 45))).toBe("2026-08-31");
  });

  it("preserves the established support-ticket issue vocabulary", () => {
    expect(canonicalSupportIssueType("Damaged goods")).toBe("Damaged Goods");
    expect(canonicalSupportIssueType("Missing items")).toBe("Missing Items");
    expect(canonicalSupportIssueType("Wrong shipment")).toBe("Wrong Shipment");
    expect(canonicalSupportIssueType("Delivery question")).toBe("Other");
    expect(canonicalSupportIssueType("future customer label")).toBe("Other");
  });

  it("normalizes only the customer-safe Finance projection", () => {
    expect(normalizeBuyerFinanceFacts({
      order_id: "order-1",
      order_number: "SO2026/09-0001",
      commercial_version_id: "version-1",
      commercial_version_number: 2,
      commercial_value: 12500,
      required_advance: 4000,
      pi_id: "pi-internal-id",
      pi_number: null,
      pi_status: "READY_FOR_ISSUE",
      verified_payment_amount: 1000,
      wallet_applied_amount: 500,
      approved_credit_amount: 0,
      covered_amount: 1500,
      advance_covered: false,
      finance_status: "advance_pending",
      facts_as_of: "2026-09-01T00:00:00Z",
      customer_safe_projection: true,
      internal_event_id: "must-not-escape",
    })).toEqual({
      order_id: "order-1",
      order_number: "SO2026/09-0001",
      commercial_version_id: "version-1",
      commercial_version_number: 2,
      commercial_value: 12500,
      required_advance: 4000,
      pi_id: "pi-internal-id",
      pi_number: null,
      pi_status: "READY_FOR_ISSUE",
      verified_payment_amount: 1000,
      wallet_applied_amount: 500,
      approved_credit_amount: 0,
      covered_amount: 1500,
      advance_covered: false,
      finance_status: "advance_pending",
      facts_as_of: "2026-09-01T00:00:00Z",
      customer_safe_projection: true,
    });
    expect(normalizeBuyerFinanceFacts({ order_id: "order-1", order_number: "SO-1", customer_safe_projection: false })).toMatchObject({
      order_id: "order-1",
      customer_safe_projection: false,
    });
    expect(normalizeBuyerFinanceFacts({ order_id: "order-1" })).toBeNull();
    expect(normalizeBuyerFinanceFacts("raw backend error")).toBeNull();
  });

  it("drops internal statement metadata while retaining customer-safe facts", () => {
    expect(normalizeBuyerStatement({
      company_id: "company-1",
      wallet_balance: 2500,
      facts_as_of: "2026-09-01T00:00:00Z",
      statement_facts_only: true,
      entries: [{
        order_id: "order-1",
        invoice_date: "2026-08-31",
        invoice_number: "INV-1",
        invoice_gross_total: 12500,
        verified_payment_total: 4000,
        pre_dispatch_net_due: 8500,
        commercially_closed: false,
        commercial_closure_id: "internal-closure-id",
      }],
      internal_ledger_id: "must-not-escape",
    })).toEqual({
      company_id: "company-1",
      wallet_balance: 2500,
      facts_as_of: "2026-09-01T00:00:00Z",
      statement_facts_only: true,
      entries: [{
        order_id: "order-1",
        invoice_date: "2026-08-31",
        invoice_number: "INV-1",
        invoice_gross_total: 12500,
        verified_payment_total: 4000,
        wallet_applied_total: null,
        approved_credit_total: null,
        credit_note_total: null,
        debit_note_total: null,
        refund_total: null,
        pre_dispatch_net_due: 8500,
        complaint_window_status: null,
        complaint_deadline: null,
        commercially_closed: false,
      }],
    });
    expect(normalizeBuyerStatement({ company_id: "company-1", entries: [{ internal_only: true }] })).toMatchObject({
      company_id: "company-1",
      entries: [{}],
    });
    expect(normalizeBuyerStatement({ entries: [] })).toBeNull();
  });

  it("reuses a general-enquiry idempotency key until Core acknowledges it", () => {
    const first = getGeneralQueryIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(getGeneralQueryIdempotencyKey()).toBe(first);
    clearGeneralQueryIdempotencyKey();
    expect(getGeneralQueryIdempotencyKey()).not.toBe(first);
  });

  it("bounds general-query history to the customer contract vocabulary", () => {
    expect(normalizeBuyerGeneralQuery({
      query_id: "query-1",
      category: "INTERNAL_QUEUE",
      subject: "Catalogue question",
      message: "Please confirm availability.",
      status: "INTERNAL_PENDING",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      internal_queue_id: "must-not-escape",
    })).toMatchObject({ query_id: "query-1", category: "GENERAL", status: "SUBMITTED" });
    expect(normalizeBuyerGeneralQuery({ query_id: "query-1", subject: "", message: "" })).toBeNull();
  });

  it("normalizes authoritative checkout quotes and matches draft lines", () => {
    const quote = normalizeBuyerCheckoutQuote({
      draft_id: "draft-1",
      fingerprint: "0123456789abcdef0123456789abcdef",
      sales_order_value: 13125,
      advance_required: 5000,
      lines: [{
        product_id: "product-1",
        quantity: 2,
        selling_price: 6250,
        currency: "INR",
        uom: "carton",
        gst_rate: 5,
        tax_inclusive: false,
        sku: "SKU-1",
        product_name: "Pista Baklawa",
        minimum_order_quantity: 1,
        order_increment: 1,
        min_carton_qty: null,
      }],
    });
    expect(quote).toMatchObject({ draft_id: "draft-1", sales_order_value: 13125 });
    expect(isCheckoutQuoteFingerprint(quote?.fingerprint ?? "")).toBe(true);
    expect(draftCartMatchesCheckoutQuote([{
      draft_id: "draft-1",
      company_id: "company-1",
      status: "active",
      readiness_status: "ready",
      readiness_issues: [],
      line_id: "line-1",
      product_id: "product-1",
      quantity: 2,
      unit_price_snapshot: 6250,
      currency_snapshot: "INR",
      uom_snapshot: "carton",
      sku_snapshot: "SKU-1",
      product_name_snapshot: "Pista Baklawa",
    }], quote!)).toBe(true);
    expect(normalizeBuyerCheckoutQuote({ draft_id: "draft-1", fingerprint: "not-a-hash" })).toBeNull();
  });

  it("rejects quoted amounts or lines that the INR-only checkout cannot safely display", () => {
    const line = {
      product_id: "p-1", quantity: 2, selling_price: 1000, currency: "INR",
      uom: "kg", gst_rate: 18, tax_inclusive: false,
      sku: "Q-1", product_name: "Baklawa",
      minimum_order_quantity: 1, order_increment: 1, min_carton_qty: null,
    };
    const quote = {
      draft_id: "d-1", fingerprint: "0123456789abcdef0123456789abcdef",
      sales_order_value: 2360, advance_required: 1000, lines: [line],
    };
    expect(normalizeBuyerCheckoutQuote(quote)).not.toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, lines: [{ ...line, currency: "USD" }] })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, lines: [{ ...line, gst_rate: 101 }] })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, lines: [{ ...line, gst_rate: -1 }] })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, lines: [{ ...line, tax_inclusive: undefined }] })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, lines: [line, { ...line }] })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, advance_required: 2361 })).toBeNull();
    expect(normalizeBuyerCheckoutQuote({ ...quote, advance_required: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("omits unsafe final-payment links from the customer-safe projection", () => {
    expect(normalizeBuyerFinalPaymentPiFacts({
      order_id: "order-1",
      available: true,
      payment_action: "PAY_NOW",
      payment_link: "javascript:alert(1)",
      final_invoice_must_not_request_payment: true,
    })).toMatchObject({
      order_id: "order-1",
      payment_action: "PAY_NOW",
      payment_link: null,
    });
    expect(normalizeBuyerFinalPaymentPiFacts({
      order_id: "order-1",
      available: true,
      payment_action: "PAY_NOW",
      payment_link: "https://pay.example.test/checkout",
      final_invoice_must_not_request_payment: true,
    })).toMatchObject({
      payment_link: "https://pay.example.test/checkout",
    });
  });
});
