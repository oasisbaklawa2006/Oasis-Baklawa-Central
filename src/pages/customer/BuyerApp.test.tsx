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
  submitApplication: vi.fn(),
  submitTicket: vi.fn(),
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
    submitApplication: buyerMock.submitApplication,
    submitTicket: buyerMock.submitTicket,
  },
  clearCheckoutIdempotencyKey: buyerMock.clearCheckoutKey,
  getCheckoutIdempotencyKey: buyerMock.getCheckoutKey,
  getLocalDateInputValue: () => "2026-08-31",
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("@/components/buyer/SystemAlertMarquee", () => ({
  default: () => null,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

  it("supports separate Add to cart and Buy now actions on product detail", async () => {
    buyerMock.addLine.mockResolvedValue(undefined);
    render(<MemoryRouter initialEntries={["/buyer/catalogue/product-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("SKU: SKU-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));
    await waitFor(() => expect(buyerMock.addLine).toHaveBeenCalledWith("product-1", 1));
    expect(await screen.findByRole("heading", { name: "Your cart" })).toBeTruthy();
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
    expect(screen.getByText("Meet the minimum order quantity shown for this product.")).toBeTruthy();
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

  it("keeps documents truthful when Core has not issued a customer-facing file", async () => {
    render(<MemoryRouter initialEntries={["/buyer/documents"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Documents" })).toBeTruthy();
    expect(screen.getByText("Documents appear when issued")).toBeTruthy();
    expect(screen.getByText(/without creating local numbers or files/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
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
