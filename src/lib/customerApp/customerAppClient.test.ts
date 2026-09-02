import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalSupportIssueType,
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
  clearGeneralQueryIdempotencyKey,
  getGeneralQueryIdempotencyKey,
  getLocalDateInputValue,
  normalizeBuyerFinanceFacts,
  normalizeBuyerGeneralQuery,
  normalizeBuyerStatement,
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
});
