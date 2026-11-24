import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ReadyGoodsTV from "../ReadyGoodsTV";
import { TvDeviceSessionContext } from "@/lib/tvDevice";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

afterEach(() => vi.clearAllMocks());

const renderDevice = () =>
  render(
    <TvDeviceSessionContext.Provider value>
      <ReadyGoodsTV />
    </TvDeviceSessionContext.Provider>,
  );

describe("ReadyGoodsTV as the RGS TV device session", () => {
  it("reads only tv_rgs_stock_snapshot() and lists balances under 10 by product id", async () => {
    rpc.mockResolvedValue({
      data: [
        { product_id: "abcdef12-0000-4000-8000-000000000000", available_qty: 3 },
        { product_id: "99999999-0000-4000-8000-000000000000", available_qty: 250 },
      ],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getByText(/Product ABCDEF12/)).toBeTruthy());
    expect(rpc).toHaveBeenCalledWith("tv_rgs_stock_snapshot");
    expect(from).not.toHaveBeenCalled(); // order_items / products / inventory_stock_balances are RLS-denied to a device
    expect(screen.queryByText(/Product 99999999/)).toBeNull();
  });

  it("shows an error screen instead of an empty board when the snapshot cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not an RGS device" } });
    renderDevice();
    await waitFor(() => expect(screen.getByTestId("rgs-tv-device-error")).toBeTruthy());
    expect(screen.getByText("not an RGS device")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });
});
