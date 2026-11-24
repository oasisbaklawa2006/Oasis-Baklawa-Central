import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FactoryTVModule from "../FactoryTVModule";
import { TvDeviceSessionContext } from "@/lib/tvDevice";

// A dedicated TV device identity is denied every table by RLS (it never satisfies is_internal_staff()); its only read
// path is Core's group-scoped tv_department_production_queue(). These tests prove the device branch uses that RPC and
// never touches tables, and that the staff branch is unchanged.
const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

afterEach(() => vi.clearAllMocks());

const renderDevice = () =>
  render(
    <TvDeviceSessionContext.Provider value>
      <FactoryTVModule category="Arabic Sweets" departmentFilter="Arabic Sweets" title="Arabic Sweets Line" />
    </TvDeviceSessionContext.Provider>,
  );

describe("FactoryTVModule as a TV device session", () => {
  it("reads only tv_department_production_queue() and labels products by id", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: "job-1", order_id: null, product_id: "abcdef12-0000-4000-8000-000000000000", assigned_qty: 6, produced_qty: 0, priority: "normal", status: "pending", department: "arabic_sweets", created_at: "2026-11-24T05:00:00Z" },
        { id: "job-2", order_id: null, product_id: "12345678-0000-4000-8000-000000000000", assigned_qty: 3, produced_qty: 1, priority: "urgent", status: "in_production", department: "arabic_sweets", created_at: "2026-11-24T05:10:00Z" },
      ],
      error: null,
    });
    renderDevice();
    await waitFor(() => expect(screen.getAllByText(/Product ABCDEF12/).length).toBeGreaterThan(0));
    expect(rpc).toHaveBeenCalledWith("tv_department_production_queue");
    expect(rpc).not.toHaveBeenCalledWith("tv_device_status", expect.anything());
    expect(from).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Product 12345678/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Unknown")).toBeNull();
  });

  it("shows an error state, never an empty 'all clear' board, when the queue cannot be read", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    renderDevice();
    await waitFor(() => expect(screen.getByText("Could not load Arabic Sweets Line")).toBeTruthy());
    expect(screen.getByText("permission denied")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
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
