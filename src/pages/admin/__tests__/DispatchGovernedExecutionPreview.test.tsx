import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DispatchGovernedExecutionPreview from "../DispatchGovernedExecutionPreview";

const consignmentRow = {
  consignment_id: "c1",
  consignment_number: "SO-2026-000001-DC-01",
  order_id: "o1",
  order_number: "SO-2026-000001",
  consignment_status: "ready_to_load",
  dispatch_mode: "road_transporter",
  consignee_name: "Test Buyer",
  destination_city: "Chennai",
  carton_count: 1,
  selected_qty: 20,
  packed_qty: 0,
  dispatched_qty: 0,
  transporter_name: null,
  finance_status: "CLEARED" as const,
  open_exception_count: 0,
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

function makeQuery(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve(result);
  return builder;
}

let viewResult: unknown[] = [consignmentRow];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => makeQuery({ data: viewResult, error: null }),
  },
}));

vi.mock("@/lib/dispatchGovernedRpc", () => ({
  dispatchGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  viewResult = [consignmentRow];
});

describe("DispatchGovernedExecutionPreview", () => {
  it("renders governed consignments from the shipment execution view", async () => {
    render(<DispatchGovernedExecutionPreview />);
    expect(await screen.findByText("SO-2026-000001-DC-01")).toBeTruthy();
    expect(screen.getByText("ready_to_load")).toBeTruthy();
    expect(screen.getByText("CLEARED")).toBeTruthy();
  });

  it("shows an empty state when there are no governed consignments yet", async () => {
    viewResult = [];
    render(<DispatchGovernedExecutionPreview />);
    expect(await screen.findByText("No governed consignments yet.")).toBeTruthy();
  });

  it("blocks consignment creation with missing order/item ids and does not call the RPC", async () => {
    render(<DispatchGovernedExecutionPreview />);
    await screen.findByText("SO-2026-000001-DC-01");

    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));

    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("blocks consignment creation with a non-positive quantity and does not call the RPC", async () => {
    render(<DispatchGovernedExecutionPreview />);
    await screen.findByText("SO-2026-000001-DC-01");

    fireEvent.change(screen.getByLabelText("Order ID"), { target: { value: "order-1" } });
    fireEvent.change(screen.getByLabelText("Order item ID"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Selected quantity"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));

    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("creates a consignment with valid input, reusing the same correlation id across a retry", async () => {
    rpcMock.mockRejectedValueOnce(new Error("network hiccup"));
    render(<DispatchGovernedExecutionPreview />);
    await screen.findByText("SO-2026-000001-DC-01");

    fireEvent.change(screen.getByLabelText("Order ID"), { target: { value: "order-1" } });
    fireEvent.change(screen.getByLabelText("Order item ID"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Selected quantity"), { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [firstCallArgs] = rpcMock.mock.calls[0];
    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(firstCallArgs).toBe("create_b2b_dispatch_consignment");
    expect(firstArgs).toMatchObject({
      p_order_id: "order-1",
      p_dispatch_mode: "road_transporter",
      p_lines: [{ order_item_id: "item-1", selected_qty: 5 }],
    });
    expect(secondArgs.p_correlation_id).toBe(firstArgs.p_correlation_id);
  });

  it("surfaces an RPC error via toast without clearing the form", async () => {
    const { toast } = await import("sonner");
    rpcMock.mockRejectedValueOnce(new Error("order not found"));
    render(<DispatchGovernedExecutionPreview />);
    await screen.findByText("SO-2026-000001-DC-01");

    fireEvent.change(screen.getByLabelText("Order ID"), { target: { value: "bad-order" } });
    fireEvent.change(screen.getByLabelText("Order item ID"), { target: { value: "item-1" } });
    fireEvent.change(screen.getByLabelText("Selected quantity"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create consignment" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("order not found"));
    expect((screen.getByLabelText("Order ID") as HTMLInputElement).value).toBe("bad-order");
  });

  it("blocks opening a carton with no consignment or code selected", async () => {
    render(<DispatchGovernedExecutionPreview />);
    await screen.findByText("SO-2026-000001-DC-01");

    fireEvent.click(screen.getByRole("button", { name: "Open carton" }));

    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });
});
