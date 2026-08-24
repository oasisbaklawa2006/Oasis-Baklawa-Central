import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReadyGoodsStore from "../ReadyGoodsStore";

// Focused coverage for release_rgs_reservation, the one RGS RPC found by a
// reachability audit to have zero callers anywhere in Central despite
// reserve_rgs_stock/pick_rgs_reservation already being wired on this same
// page. This file does not attempt full ReadyGoodsStore.tsx coverage (there
// was none before this change) -- only the new release action.

const orderId = "order-1";
const productId = "product-1";

const demandRow = {
  id: "item-1",
  order_id: orderId,
  product_id: productId,
  quantity: 10,
  actual_packed_qty: 0,
  production_status: null,
  department: null,
  order: { id: orderId, status: "approved", created_at: "2026-08-01T00:00:00.000Z", company: { business_name: "Acme" } },
  product: { id: productId, name: "Widget", sku: "WIDGET-1", production_department: "FACTORY" },
};

const reservationRow = {
  id: "res-1",
  order_id: orderId,
  product_id: productId,
  sku: "WIDGET-1",
  requested_qty: 10,
  reserved_qty: 4,
  fulfilled_qty: 0,
  released_qty: 0,
  reservation_status: "partially_reserved",
  location_code: "FINISHED_GOODS",
  created_at: "2026-08-02T00:00:00.000Z",
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

function makeQuery(data: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  const resolved = Promise.resolve({ data, error: null });
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => resolved;
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_order_availability") return makeQuery([]);
      if (relation === "order_items") return makeQuery([demandRow]);
      if (relation === "production_jobs") return makeQuery([]);
      if (relation === "production_rgs_transfers") return makeQuery([]);
      if (relation === "inventory_reservations") return makeQuery([reservationRow]);
      if (relation === "rgs_issue_events") return makeQuery([]);
      return makeQuery([]);
    },
  },
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("ReadyGoodsStore release_rgs_reservation", () => {
  it("blocks releasing a reservation with no quantity or reason entered", async () => {
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("blocks releasing a reservation with a quantity but no reason", async () => {
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("releases a reservation with the entered quantity and reason", async () => {
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "order_cancelled" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("release_rgs_reservation", expect.objectContaining({
      p_reservation_id: "res-1",
      p_release_qty: 2,
      p_reason_code: "order_cancelled",
    })));
  });

  it("surfaces an RPC error via toast and keeps the entered draft", async () => {
    const { toast } = await import("sonner");
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Not authorised" } });
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "order_cancelled" } });
    fireEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not authorised"));
    expect((screen.getByPlaceholderText("Release qty") as HTMLInputElement).value).toBe("2");
  });

  it("clears the entered draft on a successful release", async () => {
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "order_cancelled" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByPlaceholderText("Release qty") as HTMLInputElement).value).toBe(""));
  });

  // Mandatory adversarial check: release_rgs_reservation's only idempotency
  // guard is a correlation_id lookup, which does NOT independently protect a
  // partial release (only a full release flips reservation_status to a
  // non-releasable state). A lost-response retry MUST reuse the same
  // correlation id, or the RPC would double-execute -- crediting available
  // stock twice for one real release.
  it("reuses the same correlation id when retrying after a lost response with the same quantity and reason", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "order_cancelled" } });

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(secondArgs.p_correlation_id).toBe(firstArgs.p_correlation_id);
  });

  it("uses a fresh correlation id when the quantity changes before retrying", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<ReadyGoodsStore />);
    const button = await screen.findByText("Release");
    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "order_cancelled" } });

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Release qty"), { target: { value: "3" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(secondArgs.p_correlation_id).not.toBe(firstArgs.p_correlation_id);
  });
});
