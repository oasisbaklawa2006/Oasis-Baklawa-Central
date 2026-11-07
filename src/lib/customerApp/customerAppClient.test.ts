import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerAppClient,
  canonicalSupportIssueType,
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
  clearGeneralQueryIdempotencyKey,
  getGeneralQueryIdempotencyKey,
  getLocalDateInputValue,
  normalizeBuyerFinanceFacts,
  normalizeBuyerFinalPaymentPiFacts,
  normalizeBuyerGeneralQuery,
  normalizeBuyerStatement,
  toBuyerCatalogueProduct,
} from "./customerAppClient";

// Mocked Supabase client: no network. `from` is a spy so a direct table read would be observable and fail the test.
const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

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

describe("Buyer catalogue read contract", () => {
  it("maps Core's published_products_v1 projection to the Buyer product shape", () => {
    expect(
      toBuyerCatalogueProduct({
        product_id: "00000000-0000-4000-8000-000000000100",
        sku: "CERT-BUYER-GOLDEN-001",
        product_name: "Synthetic Certification Baklawa",
        short_description: "short",
        long_description: null,
        category: "Bakery",
        subcategory: "Baklawa",
        hero_image_url: "https://example.invalid/hero.webp",
        pack_size: null,
        storage_type: null,
        shelf_life: null,
        shelf_life_days: null,
        dietary_tags: null,
        allergen_warnings: null,
        primary_uom: "kg",
        created_at: "2026-11-05T00:00:00Z",
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000100",
      name: "Synthetic Certification Baklawa",
      sku: "CERT-BUYER-GOLDEN-001",
      description: "short",
      image_url: "https://example.invalid/hero.webp",
      category: "Bakery",
      sub_category: "Baklawa",
      is_active: true,
      visible_in_catalog: true,
    });
  });

  it("Buyer app never reads public.products directly (Core limits it to internal staff)", () => {
    const source = readFileSync(resolve(__dirname, "../../pages/customer/BuyerApp.tsx"), "utf8");
    expect(source).not.toMatch(/\.from\(\s*["']products["']\s*\)/);
    expect(source).toContain("customerAppClient.products()");
  });
});

describe("customerAppClient.products() behaviour", () => {
  const projectionRow = (overrides: Record<string, unknown> = {}) => ({
    product_id: "00000000-0000-4000-8000-000000000100",
    sku: "CERT-BUYER-GOLDEN-001",
    product_name: "Synthetic Certification Baklawa",
    short_description: "short",
    long_description: null,
    category: "Bakery",
    subcategory: "Baklawa",
    hero_image_url: "https://example.invalid/hero.webp",
    pack_size: null,
    storage_type: null,
    shelf_life: null,
    shelf_life_days: null,
    dietary_tags: null,
    allergen_warnings: null,
    primary_uom: "kg",
    created_at: "2026-11-05T00:00:00Z",
    ...overrides,
  });

  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockReset();
  });

  it("reads only Core's published_products_v1 RPC, never the products table, and maps the result", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [
        projectionRow(),
        projectionRow({
          product_id: "00000000-0000-4000-8000-000000000101",
          sku: "CERT-BUYER-GOLDEN-002",
          product_name: "Second Synthetic Product",
          short_description: "short two",
          long_description: "long two",
          category: "Chocolates",
          subcategory: null,
          hero_image_url: null,
        }),
      ],
      error: null,
    });

    const products = await customerAppClient.products();

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("published_products_v1");
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(products).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000100",
        name: "Synthetic Certification Baklawa",
        sku: "CERT-BUYER-GOLDEN-001",
        description: "short",
        image_url: "https://example.invalid/hero.webp",
        category: "Bakery",
        sub_category: "Baklawa",
        is_active: true,
        visible_in_catalog: true,
      },
      {
        id: "00000000-0000-4000-8000-000000000101",
        name: "Second Synthetic Product",
        sku: "CERT-BUYER-GOLDEN-002",
        description: "long two", // the long description wins over the short one
        image_url: null,
        category: "Chocolates",
        sub_category: null,
        is_active: true,
        visible_in_catalog: true,
      },
    ]);
  });

  it("returns an empty catalogue for null or empty projection data", async () => {
    for (const data of [null, []]) {
      supabaseMock.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(customerAppClient.products()).resolves.toEqual([]);
    }
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("surfaces a safe error without leaking the database message, and still never reads the table", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'relation "internal_secret_table" denied' } });

    const failure = await customerAppClient.products().then(
      () => null,
      (error: unknown) => error as Error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure?.message).toBe("We couldn't complete that request. Please try again.");
    expect(failure?.message).not.toContain("internal_secret_table");
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
