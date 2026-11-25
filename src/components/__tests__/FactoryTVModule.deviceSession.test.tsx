import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FactoryTVModule from "../FactoryTVModule";
import { TV_QUEUE_LEGACY_RPC, TV_QUEUE_NAMED_RPC, TvDeviceSessionContext } from "@/lib/tvDevice";

// A dedicated TV device identity is denied every table by RLS (it never satisfies is_internal_staff()); its only read
// path is Core's group-scoped department queue (named RPC, legacy RPC only while the named one is not deployed). These
// tests prove the device branch uses those RPCs and never touches tables, and that the staff branch is unchanged.
const rpc = vi.fn();
const from = vi.fn();
// Lets one test replace the queue read to simulate a response slower than the request timeout, so the board's own
// "newest refresh wins" guard is exercised independently of the helper's timeout. Null = use the real helper.
const hooks = vi.hoisted(() => ({ queueOverride: null as null | (() => Promise<unknown>) }));
vi.mock("@/lib/tvDevice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tvDevice")>();
  return {
    ...actual,
    fetchTvDepartmentProductionQueue: (...args: Parameters<typeof actual.fetchTvDepartmentProductionQueue>) =>
      hooks.queueOverride ? hooks.queueOverride() : actual.fetchTvDepartmentProductionQueue(...args),
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

afterEach(() => {
  hooks.queueOverride = null;
  vi.useRealTimers();
  vi.clearAllMocks();
  rpc.mockReset();
});

const job = (over: Record<string, unknown>) => ({
  id: "job-1",
  order_id: null,
  product_id: "abcdef12-0000-4000-8000-000000000000",
  assigned_qty: 6,
  produced_qty: 0,
  priority: "normal",
  status: "pending",
  department: "arabic_sweets",
  created_at: "2026-11-24T05:00:00Z",
  ...over,
});

const MISSING_NAMED = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };

const renderDevice = () =>
  render(
    <TvDeviceSessionContext.Provider value>
      <FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" />
    </TvDeviceSessionContext.Provider>,
  );

describe("FactoryTVModule as a TV device session", () => {
  it("reads only the named department queue and shows each job's product name, never a UUID", async () => {
    rpc.mockResolvedValue({
      data: [
        job({ id: "job-1", product_name: "Pistachio Baklawa 250g", sku: "BKL-PIST-250" }),
        job({ id: "job-2", product_id: "12345678-0000-4000-8000-000000000000", product_name: "Walnut Baklawa 500g", sku: "BKL-WALN-500", assigned_qty: 3, produced_qty: 1, priority: "urgent", status: "in_production" }),
      ],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/Pistachio Baklawa 250g/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Walnut Baklawa 500g/).length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith(TV_QUEUE_NAMED_RPC);
    expect(rpc).not.toHaveBeenCalledWith(TV_QUEUE_LEGACY_RPC);
    expect(rpc).not.toHaveBeenCalledWith("tv_device_status", expect.anything());
    expect(from).not.toHaveBeenCalled();
    expect(screen.queryByText(/Product ref/)).toBeNull();
    expect(screen.queryByText(/ABCDEF12/)).toBeNull();
  });

  it("shows the SKU when a job has a SKU but no name, and a short reference only when Core supplied neither", async () => {
    rpc.mockResolvedValue({
      data: [
        job({ id: "job-1", product_name: null, sku: "BKL-ONLY-SKU" }),
        job({ id: "job-2", product_id: "12345678-0000-4000-8000-000000000000", product_name: null, sku: null }),
      ],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/BKL-ONLY-SKU/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Product ref 12345678/).length).toBeGreaterThan(0);
  });

  it("falls back to the legacy queue, with honest product references, only while the named RPC is not deployed", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === TV_QUEUE_NAMED_RPC ? MISSING_NAMED : { data: [job({})], error: null },
    );
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/Product ref ABCDEF12/).length).toBeGreaterThan(0));
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([TV_QUEUE_NAMED_RPC, TV_QUEUE_LEGACY_RPC]);
    expect(from).not.toHaveBeenCalled();
  });

  it("does not fall back to the legacy queue when the named RPC fails for any other reason", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === TV_QUEUE_NAMED_RPC
        ? { data: null, error: { code: "42501", message: "permission denied for function" } }
        : { data: [job({})], error: null },
    );
    renderDevice();
    await waitFor(() => expect(screen.getByText("Could not load Arabic Sweets Line")).toBeTruthy());
    expect(screen.getByText("permission denied for function")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalledWith(TV_QUEUE_LEGACY_RPC);
  });

  it("ignores a slow older refresh that finishes after a newer one (a completed job must not reappear)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveOlder!: (value: unknown) => void;
    const older = new Promise((resolve) => {
      resolveOlder = resolve;
    });
    const newer = [job({ id: "job-new", product_name: "Newer Board Item", sku: "NEW-1" })];
    let calls = 0;
    hooks.queueOverride = () => (++calls === 1 ? (older as Promise<unknown>) : Promise.resolve(newer));
    renderDevice();
    // The first refresh is still in flight when the 30s interval starts a second one.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(screen.getAllByText(/Newer Board Item/).length).toBeGreaterThan(0));
    expect(calls).toBe(2);

    // The older response now lands with a job that has since been completed.
    await act(async () => {
      resolveOlder([job({ id: "job-done", product_name: "Already Completed Item", sku: "OLD-1" })]);
    });
    expect(screen.queryByText(/Already Completed Item/)).toBeNull();
    expect(screen.getAllByText(/Newer Board Item/).length).toBeGreaterThan(0);
  });

  it("ignores an older failure that arrives after a newer refresh succeeded", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let rejectOlder!: (reason: unknown) => void;
    const older = new Promise((_, reject) => {
      rejectOlder = reject;
    });
    older.catch(() => {});
    let calls = 0;
    hooks.queueOverride = () =>
      ++calls === 1
        ? (older as Promise<unknown>)
        : Promise.resolve([job({ id: "job-new", product_name: "Healthy Board Item", sku: "OK-1" })]);
    renderDevice();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(screen.getAllByText(/Healthy Board Item/).length).toBeGreaterThan(0));
    await act(async () => {
      rejectOlder(new Error("older refresh failed"));
    });
    expect(screen.queryByText("Could not load Arabic Sweets Line")).toBeNull();
    expect(screen.getAllByText(/Healthy Board Item/).length).toBeGreaterThan(0);
  });

  it("shows an error state, never an empty 'all clear' board, when the queue cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    renderDevice();
    await waitFor(() => expect(screen.getByText("Could not load Arabic Sweets Line")).toBeTruthy());
    expect(screen.getByText("permission denied")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it("shows an error, never 'No Open Production Jobs', when the queue payload is malformed", async () => {
    rpc.mockResolvedValue({ data: "nope", error: null });
    renderDevice();
    await waitFor(() => expect(screen.getByText("Could not load Arabic Sweets Line")).toBeTruthy());
    expect(screen.queryByText(/No Open Production Jobs/i)).toBeNull();
  });

  it("does not use the device RPC outside a device session (staff path unchanged)", async () => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.in = () => builder;
    builder.order = () => builder;
    builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
    from.mockReturnValue(builder);
    render(<FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" />);
    await waitFor(() => expect(from).toHaveBeenCalledWith("production_jobs"));
    expect(rpc).not.toHaveBeenCalled();
  });
});
