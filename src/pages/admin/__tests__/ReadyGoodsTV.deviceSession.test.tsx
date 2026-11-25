import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReadyGoodsTV from "../ReadyGoodsTV";
import { TvDeviceSessionContext } from "@/lib/tvDevice";

const rpc = vi.fn();
const from = vi.fn();
// Lets one test replace the snapshot read to simulate a response slower than the request timeout, so the board's own
// "newest refresh wins" guard is exercised independently of the helper's timeout. Null = use the real helper.
const hooks = vi.hoisted(() => ({ snapshotOverride: null as null | (() => Promise<unknown>) }));
vi.mock("@/lib/tvDevice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tvDevice")>();
  return {
    ...actual,
    fetchTvRgsStockSnapshot: (...args: Parameters<typeof actual.fetchTvRgsStockSnapshot>) =>
      hooks.snapshotOverride ? hooks.snapshotOverride() : actual.fetchTvRgsStockSnapshot(...args),
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

afterEach(() => {
  hooks.snapshotOverride = null;
  vi.useRealTimers();
  vi.clearAllMocks();
  rpc.mockReset();
});

const renderDevice = () =>
  render(
    <TvDeviceSessionContext.Provider value>
      <ReadyGoodsTV />
    </TvDeviceSessionContext.Provider>,
  );

describe("ReadyGoodsTV as the RGS TV device session", () => {
  it("reads only tv_rgs_stock_snapshot() and lists balances under 10 by their SKU, not an abbreviated UUID", async () => {
    rpc.mockResolvedValue({
      data: [
        { product_id: "abcdef12-0000-4000-8000-000000000000", sku: "BKL-PIST-250", available_qty: 3 },
        { product_id: "99999999-0000-4000-8000-000000000000", sku: "BKL-WALN-500", available_qty: 250 },
      ],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/BKL-PIST-250/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/ABCDEF12/)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("tv_rgs_stock_snapshot");
    expect(from).not.toHaveBeenCalled(); // order_items / products / inventory_stock_balances are RLS-denied to a device
    expect(screen.queryByText(/BKL-WALN-500/)).toBeNull();
    expect(screen.queryByText(/99999999/)).toBeNull();
  });

  it("falls back to an honest product reference when a row carries no SKU", async () => {
    rpc.mockResolvedValue({
      data: [{ product_id: "abcdef12-0000-4000-8000-000000000000", sku: "  ", available_qty: 1 }],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/Product ref ABCDEF12/).length).toBeGreaterThan(0));
  });

  it("shows an error screen instead of an empty board when the snapshot cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not an RGS device" } });
    renderDevice();
    await waitFor(() => expect(screen.getByTestId("rgs-tv-device-error")).toBeTruthy());
    expect(screen.getByText("not an RGS device")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it("ignores an older snapshot that finishes after a newer one failed (the board must not read as healthy)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveOlder!: (value: unknown) => void;
    const older = new Promise((resolve) => {
      resolveOlder = resolve;
    });
    let calls = 0;
    hooks.snapshotOverride = () =>
      ++calls === 1 ? (older as Promise<unknown>) : Promise.reject(new Error("latest snapshot failed"));
    renderDevice();
    // The 30s refresh starts a second request while the first is still in flight; the second fails.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(screen.getByTestId("rgs-tv-device-error")).toBeTruthy());
    expect(screen.getByText("latest snapshot failed")).toBeTruthy();
    expect(calls).toBe(2);

    // The older, successful response now lands: it must not clear the error or restore older stock data.
    await act(async () => {
      resolveOlder([{ product_id: "abcdef12-0000-4000-8000-000000000000", sku: "OLD-SKU-1", available_qty: 1 }]);
    });
    expect(screen.getByTestId("rgs-tv-device-error")).toBeTruthy();
    expect(screen.getByText("latest snapshot failed")).toBeTruthy();
    expect(screen.queryByText(/OLD-SKU-1/)).toBeNull();
  });

  it("ignores an older failure that arrives after a newer snapshot succeeded", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let rejectOlder!: (reason: unknown) => void;
    const older = new Promise((_, reject) => {
      rejectOlder = reject;
    });
    older.catch(() => {});
    let calls = 0;
    hooks.snapshotOverride = () =>
      ++calls === 1
        ? (older as Promise<unknown>)
        : Promise.resolve([{ product_id: "abcdef12-0000-4000-8000-000000000000", sku: "NEWER-SKU-1", available_qty: 1 }]);
    renderDevice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(screen.getAllByText(/NEWER-SKU-1/).length).toBeGreaterThan(0));
    await act(async () => {
      rejectOlder(new Error("older snapshot failed"));
    });
    expect(screen.queryByTestId("rgs-tv-device-error")).toBeNull();
    expect(screen.getAllByText(/NEWER-SKU-1/).length).toBeGreaterThan(0);
  });

  it("does not present unreadable order demand as empty demand on a device session", async () => {
    rpc.mockResolvedValue({ data: [{ product_id: "abcdef12-0000-4000-8000-000000000000", sku: "BKL-PIST-250", available_qty: 3 }], error: null });
    renderDevice();
    await waitFor(() => expect(screen.getByTestId("rgs-tv-demand-unavailable")).toBeTruthy());
    expect(screen.getByText("Order demand is not available on this display")).toBeTruthy();
    // None of the staff demand panels (which would read "Empty" / "0 SKUs") are rendered for a device.
    for (const title of ["Ready for Dispatch", "Partial Orders", "Pending Production", "SKU-Wise Demand Summary"]) {
      expect(screen.queryByText(title)).toBeNull();
    }
    expect(screen.queryByText("Empty")).toBeNull();
    expect(screen.queryByText(/\b0 SKUs\b/)).toBeNull();
    // The stock the device CAN read is still shown.
    expect(screen.getAllByText(/BKL-PIST-250/).length).toBeGreaterThan(0);
    expect(screen.getByText("Low Stock")).toBeTruthy();
  });

  it("rejects an unexpected snapshot payload instead of showing an all-clear board", async () => {
    rpc.mockResolvedValue({ data: "nope", error: null });
    renderDevice();
    await waitFor(() => expect(screen.getByTestId("rgs-tv-device-error")).toBeTruthy());
    expect(screen.queryByText("All OK")).toBeNull();
  });

  it("keeps the staff demand panels unchanged outside a device session", async () => {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "in", "neq", "order", "eq", "lt"]) builder[m] = () => builder;
    builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
    from.mockReturnValue(builder);
    render(<ReadyGoodsTV />);
    await waitFor(() => expect(screen.getByText("Ready for Dispatch")).toBeTruthy());
    expect(screen.getByText("Partial Orders")).toBeTruthy();
    expect(screen.getByText("Pending Production")).toBeTruthy();
    expect(screen.getByText("SKU-Wise Demand Summary")).toBeTruthy();
    expect(screen.queryByTestId("rgs-tv-demand-unavailable")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
