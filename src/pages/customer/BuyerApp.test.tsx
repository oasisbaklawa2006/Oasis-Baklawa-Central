import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuyerApp from "./BuyerApp";

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
  it("submits the selected requested dispatch date through the idempotent Core checkout", async () => {
    render(<MemoryRouter initialEntries={["/buyer/cart"]}><BuyerApp /></MemoryRouter>);

    const dateInput = await screen.findByLabelText(/Requested dispatch date/);
    fireEvent.change(dateInput, { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit order" }));

    await waitFor(() => expect(buyerMock.submit).toHaveBeenCalledWith("checkout-key", "2026-09-10"));
    expect(buyerMock.clearCheckoutKey).toHaveBeenCalledTimes(1);
  });

  it("renders the exact Core SO identity and commercial order value", async () => {
    render(<MemoryRouter initialEntries={["/buyer/orders/order-1"]}><BuyerApp /></MemoryRouter>);

    expect(await screen.findByText("SO2026/08-0001")).toBeTruthy();
    expect(screen.getByText("SO value")).toBeTruthy();
    expect(screen.getByText("₹12,500")).toBeTruthy();
    expect(screen.getByText("2026-09-10")).toBeTruthy();
    expect(screen.getByText("2026-09-12")).toBeTruthy();
  });

  it("does not create a governed order from the non-order support screen", async () => {
    render(<MemoryRouter initialEntries={["/buyer/support"]}><BuyerApp /></MemoryRouter>);

    const submitTicket = await screen.findByRole("button", { name: "Submit ticket" });
    expect(submitTicket).toBeDisabled();
    expect(buyerMock.submit).not.toHaveBeenCalled();
    expect(buyerMock.submitTicket).not.toHaveBeenCalled();
  });
});
