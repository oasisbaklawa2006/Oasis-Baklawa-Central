import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import ThirdPartyStore from "../ThirdPartyStore";

vi.mock("@/components/TopNavBar", () => ({ default: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: "STORE_3RD_PARTY" }) }));

function renderPage() {
  return render(<ThirdPartyStore />);
}

const pendingItem = {
  id: "item-1",
  order_id: "order-1",
  quantity: 8,
  actual_packed_qty: null,
  production_status: "pending",
  notes: null,
  product: { name: "Ribbon Pack", sku: "RIBBON-1" },
};

let itemsResult: unknown[] = [pendingItem];

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: itemsResult, error: null }),
      };
      return chain;
    },
  },
}));

vi.mock("@/lib/threePgsOrderItemRpc", () => ({
  threePgsOrderItemRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  itemsResult = [pendingItem];
});

describe("ThirdPartyStore governed completion", () => {
  it("calls complete_3pgs_order_item with the item's own quantity as the packed qty", async () => {
    renderPage();
    const button = await screen.findByText("Done");
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("complete_3pgs_order_item", {
      p_order_item_id: "item-1",
      p_actual_packed_qty: 8,
    }));
  });

  it("does not offer to complete an item that is already completed", async () => {
    itemsResult = [{ ...pendingItem, production_status: "completed", actual_packed_qty: 8 }];
    renderPage();
    await screen.findByText("Ribbon Pack");
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("surfaces an RPC error via toast without marking the item complete", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "not authorised" } });
    renderPage();
    const button = await screen.findByText("Done");
    fireEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("not authorised"));
    expect(screen.getByText("Done")).toBeTruthy();
  });
});
