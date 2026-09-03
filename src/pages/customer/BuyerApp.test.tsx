import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuyerApp, { BuyerAccessRequest } from "./BuyerApp";

const buyerMock = vi.hoisted(() => ({
  submit: vi.fn(),
  clearCheckoutKey: vi.fn(),
  getCheckoutKey: vi.fn(() => "checkout-key"),
  company: vi.fn(),
  team: vi.fn(),
  prices: vi.fn(),
  draft: vi.fn(),
  addLine: vi.fn(),
  updateLine: vi.fn(),
  removeLine: vi.fn(),
  clearDraft: vi.fn(),
  orders: vi.fn(),
  items: vi.fn(),
  tickets: vi.fn(),
  commercialFacts: vi.fn(),
  financeFacts: vi.fn(),
  finalPaymentPiFacts: vi.fn(),
  proformaInvoices: vi.fn(),
  documents: vi.fn(),
  statement: vi.fn(),
  favourites: vi.fn(),
  setFavourite: vi.fn(),
  generalQueries: vi.fn(),
  submitGeneralQuery: vi.fn(),
  submitApplication: vi.fn(),
  submitTicket: vi.fn(),
  clearGeneralQueryKey: vi.fn(),
  getGeneralQueryKey: vi.fn(() => "general-query-key"),
  order: {
    order_id: "order-1",
    order_number: "SO2026/08-0001",
    customer_stage: "submitted",
    payment_stage: "awaiting_receipt",
    order_value: 12500,
    total_weight_kg: 10,
    requested_dispatch_date: "2026-09-10",
    promised_dispatch_date: "2026-09-12",
    tracking_number: null,
    courier_name: null,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
  },
  draftLine: {
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
  },
  product: {
    id: "product-1",
    name: "Pista Baklawa",
    sku: "SKU-1",
    description: "Premium baklawa",
    image_url: null,
    category: "Baklawa",
    sub_category: "Classic",
    is_active: true,
    visible_in_catalog: true,
  },
  price: {
    product_id: "product-1",
    selling_price: 6250,
    currency: "INR",
    uom: "carton",
    gst_rate: 5,
    tax_inclusive: false,
    applied_discount_percent: null,
    minimum_order_quantity: 1,
    minimum_order_uom: "carton",
    order_increment: 1,
    order_increment_uom: "carton",
    valid_from: null,
    valid_until: null,
  },
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/customerApp/customerAppClient", () => ({
  customerAppClient: {
    company: buyerMock.company,
    team: buyerMock.team,
    prices: buyerMock.prices,
    draft: buyerMock.draft,
    addLine: buyerMock.addLine,
    updateLine: buyerMock.updateLine,
    removeLine: buyerMock.removeLine,
    clearDraft: buyerMock.clearDraft,
    submit: buyerMock.submit,
    orders: buyerMock.orders,
    items: buyerMock.items,
    tickets: buyerMock.tickets,
    commercialFacts: buyerMock.commercialFacts,
    financeFacts: buyerMock.financeFacts,
    finalPaymentPiFacts: buyerMock.finalPaymentPiFacts,
    proformaInvoices: buyerMock.proformaInvoices,
    documents: buyerMock.documents,
    statement: buyerMock.statement,
    favourites: buyerMock.favourites,
    setFavourite: buyerMock.setFavourite,
    generalQueries: buyerMock.generalQueries,
    submitGeneralQuery: buyerMock.submitGeneralQuery,
    submitApplication: buyerMock.submitApplication,
    submitTicket: buyerMock.submitTicket,
  },
  GENERAL_QUERY_CATEGORIES: ["GENERAL", "CATALOGUE", "ACCOUNT", "DELIVERY", "OTHER"],
  clearCheckoutIdempotencyKey: buyerMock.clearCheckoutKey,
  getCheckoutIdempotencyKey: buyerMock.getCheckoutKey,
  clearGeneralQueryIdempotencyKey: buyerMock.clearGeneralQueryKey,
  getGeneralQueryIdempotencyKey: buyerMock.getGeneralQueryKey,
  getLocalDateInputValue: () => "2026-08-31",
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("@/components/buyer/SystemAlertMarquee", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve({ data: [buyerMock.product], error: null }).then(onFulfilled);
      return builder;
    }),
  },
}));

beforeEach(() => {
  buyerMock.submit.mockResolvedValue([buyerMock.order]);
  buyerMock.clearCheckoutKey.mockImplementation(() => undefined);
  buyerMock.clearGeneralQueryKey.mockImplementation(() => undefined);
  buyerMock.company.mockResolvedValue([{
    company_id: "company-1",
    business_name: "Buyer Co",
    gst_number: "GST-1",
    status: "approved",
    price_tier: "standard",
    payment_terms: "advance",
    registered_address: "1 Buyer Street",
    phone: "9999999999",
    is_frozen: false,
  }]);
  buyerMock.team.mockResolvedValue([]);
  buyerMock.prices.mockResolvedValue([buyerMock.price]);
  buyerMock.draft.mockResolvedValue([buyerMock.draftLine]);
  buyerMock.orders.mockResolvedValue([buyerMock.order]);
  buyerMock.items.mockResolvedValue([{
    order_id: "order-1",
    item_id: "item-1",
    product_id: "product-1",
    sku: "SKU-1",
    product_name: "Pista Baklawa",
    quantity: 2,
    pack_size: "carton",
    weight_kg: 10,
    packed_quantity: null,
  }]);
  buyerMock.tickets.mockResolvedValue([]);
  buyerMock.commercialFacts.mockResolvedValue([]);
  buyerMock.financeFacts.mockResolvedValue(null);
  buyerMock.finalPaymentPiFacts.mockResolvedValue(null);
  buyerMock.proformaInvoices.mockResolvedValue([]);
  buyerMock.documents.mockResolvedValue([]);
  buyerMock.statement.mockResolvedValue(null);
  buyerMock.favourites.mockResolvedValue([]);
  buyerMock.setFavourite.mockResolvedValue([{ product_id: "product-1", is_favourite: true }]);
  buyerMock.generalQueries.mockResolvedValue([]);
  buyerMock.submitGeneralQuery.mockResolvedValue([{ query_id: "query-1", status: "SUBMITTED", is_duplicate_submission: false }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Buyer App governed commercial handoff", () => {
  it("renders the five-point mobile navigation and safe dashboard summary", async () => {
    render(<MemoryRouter initialEntries={["/buyer"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Buyer Co" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Buyer navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Catalogue" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Orders" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quick order and cart" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Account" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open customer support" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Track Order/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Reorder/ })).toBeTruthy();
    expect(screen.queryByText(/advance/i)).toBeNull();
  });

  it("takes the primary New Order action into the catalogue", async () => {
    render(<MemoryRouter initialEntries={["/buyer"]}><BuyerApp /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: /Browse catalogue/ }));
    expect(await screen.findByRole("heading", { name: "Catalogue" })).toBeTruthy();
  });

  it("opens governed support from the floating action without invoking checkout", async () => {
    render(<MemoryRouter initialEntries={["/buyer"]}><BuyerApp /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("link", { name: "Open customer support" }));
    expect(await screen.findByRole("heading", { name: "Support" })).toBeTruthy();
    expect(buyerMock.submit).not.toHaveBeenCalled();
  });

  it("filters the approved catalogue by product name and keeps Core pricing visible", async () => {
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);

    const search = await screen.findByRole("textbox", { name: "Search products or SKU" });
    expect(screen.getByText("1 approved product")).toBeTruthy();
    expect(screen.getByText("₹6,250")).toBeTruthy();
    fireEvent.change(search, { target: { value: "does-not-exist" } });
    expect(screen.getByText("No products found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Pista Baklawa")).toBeTruthy();
  });

  it("applies only the supported category filter", async () => {
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);

    const category = await screen.findByLabelText("Filter by category");
    fireEvent.change(category, { target: { value: "Baklawa" } });
    expect(screen.getByText("Pista Baklawa")).toBeTruthy();
    expect(screen.getByText("1 approved product")).toBeTruthy();
  });

  it("filters the catalogue by the governed product subcategory", async () => {
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);

    const subcategory = await screen.findByLabelText("Filter by subcategory");
    fireEvent.change(subcategory, { target: { value: "Classic" } });
    expect(screen.getByText("Pista Baklawa")).toBeTruthy();
    fireEvent.change(subcategory, { target: { value: "all" } });
    expect(screen.getByText("1 approved product")).toBeTruthy();
  });

  it("supports separate Add to cart and Buy now actions on product detail", async () => {
    buyerMock.addLine.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/catalogue/product-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("SKU: SKU-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));
    await waitFor(() => expect(buyerMock.addLine).toHaveBeenCalledWith("product-1", 1));
    expect(await screen.findByRole("heading", { name: "Your cart" })).toBeTruthy();
  });

  it("prevents duplicate product submissions while the governed add is pending", async () => {
    buyerMock.addLine.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 20)));
    render(<MemoryRouter initialEntries={["/buyer/catalogue/product-1"]}><BuyerApp /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Buy now" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(buyerMock.addLine).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your cart" })).toBeTruthy());
  });

  it.each([
    ["NaN", Number.NaN],
    ["null", null as unknown as number],
  ])("fails closed when a product has no usable customer price (%s)", async (_label, sellingPrice) => {
    buyerMock.prices.mockResolvedValue([{ ...buyerMock.price, selling_price: sellingPrice }]);
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Pricing unavailable for this account.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });

  it("keeps MOQ and increment controls on the governed draft path", async () => {
    buyerMock.addLine.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/catalogue/product-1"]}><BuyerApp /></MemoryRouter>);

    await screen.findByText("SKU: SKU-1");
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(buyerMock.addLine).toHaveBeenCalledWith("product-1", 2));
  });

  it("renders cart line identity and prevents submit while Core reports readiness issues", async () => {
    buyerMock.draft.mockResolvedValue([{
      ...buyerMock.draftLine,
      readiness_status: "blocked",
      readiness_issues: [{ code: "MOQ_NOT_MET" }],
    }, {
      ...buyerMock.draftLine,
      line_id: "line-2",
      readiness_status: "blocked",
      readiness_issues: [{ code: "INVENTORY_UNAVAILABLE", detail: "Internal inventory detail" }],
    }]);
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    expect((await screen.findAllByText("SKU SKU-1 · carton")).length).toBe(2);
    expect(screen.getAllByText(/line preview/).every((element) => element.textContent?.includes("₹12,500"))).toBe(true);
    expect(screen.getByText("Review your quantities before submitting")).toBeTruthy();
    expect(screen.getByText("Minimum order is 1 carton.")).toBeTruthy();
    expect(screen.getByText("Review the quantity and carton requirements before submitting.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit order" })).toBeDisabled();
  });

  it("submits the selected requested dispatch date through the idempotent Core checkout", async () => {
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    const dateInput = await screen.findByLabelText(/Requested dispatch date/);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit order" }));

    await waitFor(() => expect(buyerMock.submit).toHaveBeenCalledWith("checkout-key", "2026-09-10"));
    expect(buyerMock.clearCheckoutKey).toHaveBeenCalledTimes(1);
  });

  it("keeps the same checkout idempotency key available after a failed submit", async () => {
    buyerMock.submit.mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce([buyerMock.order]);
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    const submitOrder = await screen.findByRole("button", { name: "Submit order" });
    fireEvent.click(submitOrder);
    await waitFor(() => expect(buyerMock.submit).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Submit order" }));
    await waitFor(() => expect(buyerMock.submit).toHaveBeenCalledTimes(2));
    expect(buyerMock.submit).toHaveBeenNthCalledWith(1, "checkout-key", undefined);
    expect(buyerMock.submit).toHaveBeenNthCalledWith(2, "checkout-key", undefined);
  });

  it("renders the exact Core SO identity and commercial order value", async () => {
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("SO2026/08-0001")).toBeTruthy();
    expect(screen.getByText("SO value")).toBeTruthy();
    expect(screen.getByText("₹12,500")).toBeTruthy();
    expect(screen.getByText("2026-09-10")).toBeTruthy();
    expect(screen.getByText("2026-09-12")).toBeTruthy();
    expect(screen.getByText("Order progress")).toBeTruthy();
    expect(screen.getAllByText("Order received").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Payment details needed")).toBeTruthy();
  });

  it("merges authoritative commercial facts into list and detail without generating an SO reference", async () => {
    buyerMock.commercialFacts.mockResolvedValue([{
      order_id: "order-1",
      order_number: "SO2026/09-0001",
      commercial_version_id: "version-2",
      commercial_version_number: 2,
      frozen_sales_order_value: 18750,
      requested_dispatch_date: "2026-09-14",
      promised_dispatch_date: "2026-09-16",
      commercial_status: "FROZEN",
      finance_status: "pi_pending",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    }]);
    const { unmount } = render(<MemoryRouter initialEntries={["/buyer/orders"]}><BuyerApp /></MemoryRouter>);
    expect(await screen.findByText("SO2026/09-0001")).toBeTruthy();
    expect(screen.getByText("₹18,750")).toBeTruthy();
    expect(screen.getAllByText("Proforma invoice is being prepared").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/SO2026\/09-0002/)).toBeNull();
    unmount();
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);
    expect(await screen.findByText("SO2026/09-0001")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.getByText("2026-09-14")).toBeTruthy();
    expect(screen.getByText("2026-09-16")).toBeTruthy();
  });

  it("renders customer-safe Finance facts and never calculates coverage in the browser", async () => {
    buyerMock.financeFacts.mockResolvedValue({
      order_id: "order-1",
      order_number: "SO2026/09-0001",
      commercial_version_id: "version-2",
      commercial_version_number: 2,
      commercial_value: 18750,
      required_advance: 6000,
      pi_id: "internal-pi-id",
      pi_number: null,
      pi_status: "READY_FOR_ISSUE",
      verified_payment_amount: 2500,
      wallet_applied_amount: 500,
      approved_credit_amount: 1000,
      covered_amount: 4000,
      advance_covered: false,
      finance_status: "advance_pending",
      facts_as_of: "2026-09-01T00:00:00.000Z",
      customer_safe_projection: true,
    });
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Payment and Finance" })).toBeTruthy();
    expect(screen.getAllByText("₹18,750").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("₹6,000")).toBeTruthy();
    expect(screen.getByText("₹2,500")).toBeTruthy();
    expect(screen.getByText("₹500")).toBeTruthy();
    expect(screen.getByText("₹1,000")).toBeTruthy();
    expect(screen.getByText("₹4,000")).toBeTruthy();
    expect(screen.getAllByText("Advance payment is needed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Proforma invoice: Preparing/)).toBeTruthy();
    expect(screen.queryByText("internal-pi-id")).toBeNull();
    expect(screen.queryByText(/30%|nearest|rounded|coverage calculation/i)).toBeNull();
  });

  it.each([
    ["READY_FOR_ISSUE", null, "Preparing"],
    ["ISSUED", "PI2026/09-0001", "Reference PI2026/09-0001 is available."],
  ])("shows the exact PI number only after issuance (%s)", async (status, number, detail) => {
    buyerMock.proformaInvoices.mockResolvedValue([{
      pi_id: "pi-1",
      customer_visible_pi_number: number,
      order_id: "order-1",
      order_number: "SO2026/09-0001",
      commercial_version_id: "version-2",
      commercial_version_number: 2,
      status,
      issued_at: status === "ISSUED" ? "2026-09-01T01:00:00.000Z" : null,
      frozen_customer_total: 18750,
      created_at: "2026-09-01T00:00:00.000Z",
    }]);
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);
    const heading = await screen.findByRole("heading", { name: "Proforma Invoice" });
    const card = heading.parentElement?.parentElement;
    expect(card?.textContent).toContain(detail);
    if (status === "READY_FOR_ISSUE") expect(card?.textContent).not.toContain("PI2026/");
  });

  it("maps issued, preparing and unavailable documents without fabricating files", async () => {
    buyerMock.documents.mockResolvedValue([
      { document_type: "SALES_ORDER", document_id: "so-doc", document_number: "SO2026/09-0001", order_id: "order-1", order_number: "SO2026/09-0001", commercial_version_id: "version-2", status: "ISSUED", issued_at: "2026-09-01T00:00:00.000Z", customer_total: 18750, availability_state: "issued" },
      { document_type: "FINAL_INVOICE", document_id: "invoice-doc", document_number: null, order_id: "order-1", order_number: "SO2026/09-0001", commercial_version_id: "version-2", status: "PREPARING", issued_at: null, customer_total: null, availability_state: "preparing" },
      { document_type: "PROFORMA_INVOICE", document_id: "pi-doc", document_number: null, order_id: "order-1", order_number: "SO2026/09-0001", commercial_version_id: "version-2", status: "UNAVAILABLE", issued_at: null, customer_total: null, availability_state: "unavailable" },
    ]);
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);
    expect(await screen.findByText("Reference SO2026/09-0001 is available.")).toBeTruthy();
    expect(screen.getByText("This document is being prepared and will appear here when issued.")).toBeTruthy();
    expect(screen.getByText("This document is not available yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
  });

  it("keeps document and PI identities scoped to their order", async () => {
    const firstOrderData = { ...buyerMock.order, order_number: "SO2026/09-0001" };
    const secondOrderData = { ...buyerMock.order, order_id: "order-2", order_number: "SO2026/09-0002" };
    buyerMock.orders.mockResolvedValue([firstOrderData, secondOrderData]);
    buyerMock.proformaInvoices.mockResolvedValue([
      { pi_id: "pi-1", customer_visible_pi_number: "PI2026/09-0001", order_id: "order-1", order_number: "SO2026/09-0001", commercial_version_id: "version-1", commercial_version_number: 1, status: "ISSUED", issued_at: "2026-09-01T00:00:00.000Z", frozen_customer_total: 12500, created_at: "2026-09-01T00:00:00.000Z" },
      { pi_id: "pi-2", customer_visible_pi_number: "PI2026/09-0002", order_id: "order-2", order_number: "SO2026/09-0002", commercial_version_id: "version-1", commercial_version_number: 1, status: "ISSUED", issued_at: "2026-09-01T00:00:00.000Z", frozen_customer_total: 25000, created_at: "2026-09-01T00:00:00.000Z" },
    ]);
    buyerMock.documents.mockResolvedValue([
      { document_type: "SALES_ORDER", document_id: "so-doc-1", document_number: "SO2026/09-0001", order_id: "order-1", order_number: "SO2026/09-0001", commercial_version_id: "version-1", status: "ISSUED", issued_at: "2026-09-01T00:00:00.000Z", customer_total: 12500, availability_state: "issued" },
      { document_type: "SALES_ORDER", document_id: "so-doc-2", document_number: "SO2026/09-0002", order_id: "order-2", order_number: "SO2026/09-0002", commercial_version_id: "version-1", status: "ISSUED", issued_at: "2026-09-01T00:00:00.000Z", customer_total: 25000, availability_state: "issued" },
    ]);
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);

    const firstOrder = await screen.findByRole("heading", { name: "SO2026/09-0001" });
    const firstOrderSection = firstOrder.closest("[aria-labelledby]");
    const secondOrderHeading = screen.getByRole("heading", { name: "SO2026/09-0002" });
    const secondOrderSection = secondOrderHeading.closest("[aria-labelledby]");
    expect(firstOrderSection?.textContent).toContain("PI2026/09-0001");
    expect(firstOrderSection?.textContent).not.toContain("PI2026/09-0002");
    expect(secondOrderSection?.textContent).toContain("PI2026/09-0002");
    expect(secondOrderSection?.textContent).not.toContain("PI2026/09-0001");
  });

  it("renders customer-safe statement facts without internal closure identifiers", async () => {
    buyerMock.statement.mockResolvedValue({
      company_id: "company-1",
      wallet_balance: 2500,
      facts_as_of: "2026-09-01T00:00:00.000Z",
      statement_facts_only: true,
      entries: [{
        order_id: "order-1",
        invoice_date: "2026-09-01",
        invoice_number: "INV-2026-0001",
        invoice_gross_total: 18750,
        verified_payment_total: 6000,
        wallet_applied_total: 500,
        approved_credit_total: 1000,
        credit_note_total: 0,
        debit_note_total: 0,
        refund_total: 0,
        pre_dispatch_net_due: 11250,
        complaint_window_status: "OPEN",
        complaint_deadline: "2026-09-08",
        commercially_closed: false,
      }],
    });
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Statement facts" })).toBeTruthy();
    expect(screen.getByText("₹2,500")).toBeTruthy();
    expect(screen.getByText("INV-2026-0001")).toBeTruthy();
    expect(screen.getByText("Amount due before dispatch: ₹11,250")).toBeTruthy();
    expect(screen.queryByText(/closure|OPEN|complaint/i)).toBeNull();
  });

  it("uses server-backed favourites with rollback on failed mutation", async () => {
    buyerMock.favourites.mockResolvedValueOnce([]).mockResolvedValue([{ product_id: "product-1", created_at: "2026-09-01T00:00:00Z" }]);
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);
    const addButton = await screen.findByRole("button", { name: "Add Pista Baklawa to favourites" });
    fireEvent.click(addButton);
    expect(await screen.findByRole("button", { name: "Remove Pista Baklawa from favourites" })).toBeTruthy();
    expect(buyerMock.setFavourite).toHaveBeenCalledWith("product-1", true);

    buyerMock.setFavourite.mockRejectedValueOnce(new Error("network failure"));
    fireEvent.click(screen.getByRole("button", { name: "Remove Pista Baklawa from favourites" }));
    expect(await screen.findByRole("button", { name: "Add Pista Baklawa to favourites" })).toBeTruthy();
    expect(toastMock.error).toHaveBeenCalledWith("We couldn't update favourites. Please try again.");
  });

  it("preserves the last known favourite projection when a refresh read is transiently unavailable", async () => {
    buyerMock.favourites.mockResolvedValue([{ product_id: "product-1", created_at: "2026-09-01T00:00:00Z" }]);
    render(<MemoryRouter initialEntries={["/buyer/catalogue"]}><BuyerApp /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Remove Pista Baklawa from favourites" })).toBeTruthy();

    buyerMock.favourites.mockRejectedValueOnce(new Error("temporary read failure"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(buyerMock.favourites).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Remove Pista Baklawa from favourites" })).toBeTruthy();
  });

  it("keeps general enquiry separate from order submission and reuses the retry key", async () => {
    buyerMock.submitGeneralQuery.mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce([{ query_id: "query-1", status: "SUBMITTED", is_duplicate_submission: true }]);
    render(<MemoryRouter initialEntries={["/buyer/support"]}><BuyerApp /></MemoryRouter>);
    await screen.findByText(/separate from checkout/i);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Catalogue question" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Can you confirm the next delivery window?" } });
    const submitQuery = screen.getByRole("button", { name: "Submit general enquiry" });
    fireEvent.click(submitQuery);
    await waitFor(() => expect(buyerMock.submitGeneralQuery).toHaveBeenCalledTimes(1));
    expect(buyerMock.clearGeneralQueryKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit general enquiry" }));
    await waitFor(() => expect(buyerMock.submitGeneralQuery).toHaveBeenCalledTimes(2));
    expect(buyerMock.submitGeneralQuery).toHaveBeenNthCalledWith(1, {
      idempotencyKey: "general-query-key",
      subject: "Catalogue question",
      message: "Can you confirm the next delivery window?",
      category: "GENERAL",
    });
    expect(buyerMock.submitGeneralQuery).toHaveBeenNthCalledWith(2, {
      idempotencyKey: "general-query-key",
      subject: "Catalogue question",
      message: "Can you confirm the next delivery window?",
      category: "GENERAL",
    });
    expect(buyerMock.submit).not.toHaveBeenCalled();
  });

  it("shows an empty order state without leaking another company’s data", async () => {
    buyerMock.orders.mockResolvedValue([]);
    buyerMock.items.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/buyer/orders"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("No orders yet")).toBeTruthy();
    expect(screen.getByText("Your submitted orders will appear here.")).toBeTruthy();
    expect(screen.queryByText("SO2026/08-0001")).toBeNull();
  });

  it("supports governed reorder and returns the buyer to the persistent cart", async () => {
    buyerMock.addLine.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Reorder" }));
    await waitFor(() => expect(buyerMock.addLine).toHaveBeenCalledWith("product-1", 2));
    expect(await screen.findByRole("heading", { name: "Your cart" })).toBeTruthy();
  });

  it("offers a retry state when a customer-safe read fails", async () => {
    buyerMock.orders.mockRejectedValueOnce(new Error("temporary network failure"));
    render(<MemoryRouter initialEntries={["/buyer/orders"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Some Buyer data could not be refreshed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByRole("heading", { name: "Your orders" })).toBeTruthy();
  });

  it("maps unknown order state to neutral customer-safe copy", async () => {
    buyerMock.orders.mockResolvedValue([{ ...buyerMock.order, customer_stage: "future_internal_state", payment_stage: "future_payment_state" }]);
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Order in progress")).toBeTruthy();
    expect(screen.getByText("Payment status will appear when available")).toBeTruthy();
    expect(screen.queryByText("future_internal_state")).toBeNull();
  });

  it("keeps cart controls available for clear and line updates", async () => {
    buyerMock.updateLine.mockResolvedValue(undefined);
    buyerMock.removeLine.mockResolvedValue(undefined);
    buyerMock.clearDraft.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    await screen.findByText("Pista Baklawa");
    fireEvent.click(screen.getByRole("button", { name: "Increase Pista Baklawa quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Pista Baklawa" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear cart" }));
    await waitFor(() => {
      expect(buyerMock.updateLine).toHaveBeenCalledWith("line-1", 3);
      expect(buyerMock.removeLine).toHaveBeenCalledWith("line-1");
      expect(buyerMock.clearDraft).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a truthful empty cart state", async () => {
    buyerMock.draft.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Your cart is empty")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse catalogue" })).toBeTruthy();
  });

  it("submits order-specific support through the governed ticket RPC only", async () => {
    buyerMock.submitTicket.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/support"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText(/separate from checkout/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Order"), { target: { value: "order-1" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "The outer carton arrived damaged." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit ticket" }));
    await waitFor(() => expect(buyerMock.submitTicket).toHaveBeenCalledWith("order-1", "Damaged goods", "The outer carton arrived damaged."));
    expect(buyerMock.submit).not.toHaveBeenCalled();
  });

  it("keeps raw support backend errors out of customer copy", async () => {
    buyerMock.submitTicket.mockRejectedValueOnce(new Error("PostgREST SQLSTATE 42501 policy denied"));
    render(<MemoryRouter initialEntries={["/buyer/support"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText(/separate from checkout/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Order"), { target: { value: "order-1" } });
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "The outer carton arrived damaged." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit ticket" }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("We couldn't submit your support request. Please try again."));
    expect(screen.queryByText(/PostgREST|SQLSTATE|42501|policy denied/i)).toBeNull();
  });

  it("keeps documents truthful when Core has not issued a customer-facing file", async () => {
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(screen.getByText("Documents appear when issued")).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getAllByText("Not available yet")).toHaveLength(3);
    expect(screen.getByText(/never create local numbers or files/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
  });

  it("distinguishes an unissued Sales Order from unavailable upstream documents", async () => {
    buyerMock.orders.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Not yet issued")).toBeTruthy();
    expect(screen.getAllByText("Not available yet")).toHaveLength(3);
  });

  it("renders safe states for invalid Buyer entities and unknown routes", async () => {
    const cases = [
      { path: "/buyer/catalogue/missing-product", text: "Product unavailable" },
      { path: "/buyer/orders/missing-order", text: "Order not found" },
      { path: "/buyer/orders//order-1", text: "Buyer page not found" },
      { path: "/buyer/orders/order-1/extra", text: "Buyer page not found" },
      { path: "/buyer/not-a-real-page", text: "Buyer page not found" },
    ];
    for (const testCase of cases) {
      const { unmount } = render(<MemoryRouter initialEntries={[testCase.path]}><BuyerApp /></MemoryRouter>);
      expect(await screen.findByText(testCase.text)).toBeTruthy();
      unmount();
    }
  });

  it("redirects the historical product deep link to the governed catalogue detail", async () => {
    render(<MemoryRouter initialEntries={["/buyer/product/product-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("SKU: SKU-1")).toBeTruthy();
  });

  it("keeps primary Buyer routes renderable on direct loads", async () => {
    const routes = [
      ["/buyer", "Buyer Co"],
      ["/buyer/catalogue", "Catalogue"],
      ["/buyer/catalogue/product-1", "Pista Baklawa"],
      ["/buyer/cart", "Your cart"],
      ["/buyer/orders", "Your orders"],
      ["/buyer/orders/order-1", "Order details"],
      ["/buyer/documents", "Documents"],
      ["/buyer/account", "Account"],
      ["/buyer/support", "Support"],
    ] as const;
    for (const [path, heading] of routes) {
      const { unmount } = render(<MemoryRouter initialEntries={[path]}><BuyerApp /></MemoryRouter>);
      expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
      unmount();
    }
  });

  it("retires the legacy customer writers and keeps active writes behind the customer client", () => {
    expect(existsSync(resolve(process.cwd(), "src/components/SupportChat.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/components/CheckoutModal.tsx"))).toBe(false);
    const source = readFileSync(resolve(process.cwd(), "src/pages/customer/BuyerApp.tsx"), "utf8");
    expect(source).toMatch(/customerAppClient\.submit/);
    expect(source).not.toMatch(/\.(insert|update|delete)\s*\(/);
    expect(source).not.toMatch(/functions\.invoke|\bfetch\s*\(/);
  });

  it("uses safe account and team labels rather than internal role codes", async () => {
    buyerMock.team.mockResolvedValue([{ profile_id: "profile-2", full_name: "A Buyer", email: "a@example.com", mobile_number: null, role: "B2B_BUYER", status: "active" }]);
    render(<MemoryRouter initialEntries={["/buyer/account"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("Active buyer account")).toBeTruthy();
    expect(screen.getByText("Buyer")).toBeTruthy();
    expect(screen.queryByText("B2B_BUYER")).toBeNull();
    expect(screen.getByRole("link", { name: /Documents/ })).toBeTruthy();
  });

  it("provides semantic access-request fields and keeps approval server governed", async () => {
    buyerMock.submitApplication.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/access-request"]}><BuyerAccessRequest /></MemoryRouter>);

    expect(screen.getByLabelText("Work email")).toHaveAttribute("type", "email");
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "New Buyer Co" } });
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Buyer Contact" } });
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "buyer@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit access request" }));
    await waitFor(() => expect(buyerMock.submitApplication).toHaveBeenCalled());
    expect(await screen.findByText("Request received")).toBeTruthy();
  });

  it("does not create a governed order from the non-order support screen", async () => {
    render(<MemoryRouter initialEntries={["/buyer/support"]}><BuyerApp /></MemoryRouter>);

    const submitTicket = await screen.findByRole("button", { name: "Submit ticket" });
    expect(submitTicket).toBeDisabled();
    expect(buyerMock.submit).not.toHaveBeenCalled();
    expect(buyerMock.submitTicket).not.toHaveBeenCalled();
  });
});
