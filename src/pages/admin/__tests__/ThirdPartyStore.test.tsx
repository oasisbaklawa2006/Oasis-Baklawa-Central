import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThirdPartyStore from "../ThirdPartyStore";

vi.mock("@/components/TopNavBar", () => ({
  default: () => null,
}));

function renderPage() {
  return render(<ThirdPartyStore />);
}

const queueRow = {
  id: "item-1",
  order_id: "order-1",
  quantity: 12,
  actual_packed_qty: null,
  production_status: "pending",
  notes: null,
  product: { name: "Outer Carton", sku: "CARTON-1" },
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

function makeQuery(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve(result);
  return builder;
}

let queueResult: unknown[] = [queueRow];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => makeQuery({ data: queueResult, error: null }),
  },
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  queueResult = [queueRow];
});

describe("ThirdPartyStore", () => {
  it("renders the 3PCS queue from a governed read", async () => {
    renderPage();
    expect(await screen.findByText("Outer Carton")).toBeTruthy();
    expect(screen.getByText("CARTON-1")).toBeTruthy();
  });

  it("completes an item via the governed RPC, not a direct table write", async () => {
    renderPage();
    await screen.findByText("Outer Carton");

    fireEvent.click(screen.getByRole("button", { name: /Done/i }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe("complete_3pgs_order_item");
    expect(args).toMatchObject({ p_order_item_id: "item-1", p_actual_packed_qty: 12 });
  });

  it("surfaces an RPC error via toast without marking the item complete", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Not authorised to complete a 3PGS order item" } });
    const { toast } = await import("sonner");
    renderPage();
    await screen.findByText("Outer Carton");

    fireEvent.click(screen.getByRole("button", { name: /Done/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Not authorised to complete a 3PGS order item"),
    );
    expect(screen.getByText("pending")).toBeTruthy();
  });
});
