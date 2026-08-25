import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReadyGoodsStore from "../ReadyGoodsStore";

// Certification coverage: reserve_rgs_stock (via "Allocate & route shortage")
// had no existing RPC-call-site test, despite governing the exact SO#ABB4287E
// / OAS-RIN-3 shortage-to-production_jobs path this closure is anchored on.
// This does not attempt full ReadyGoodsStore.tsx coverage -- only the
// shortage-routing action.

const orderId = "order-1";
const productId = "product-1";

const demandRow = {
  id: "item-1",
  order_id: orderId,
  product_id: productId,
  quantity: 6,
  actual_packed_qty: 0,
  production_status: null,
  department: null,
  order: { id: orderId, status: "approved", created_at: "2026-08-01T00:00:00.000Z", company: { business_name: "Acme" } },
  product: { id: productId, name: "Rings (OAS-RIN-3)", sku: "OAS-RIN-3", production_department: "ARABIC_SWEETS" },
};

const rpcMock = vi.fn(async (fn: string, _args: Record<string, unknown>) => {
  if (fn === "reserve_rgs_stock") {
    // No RGS stock available -- full requested qty is short, mirroring the
    // golden regression case (SO#ABB4287E, OAS-RIN-3, required 6).
    return { data: { requested_qty: 6, reserved_qty: 0, fulfilled_qty: 0, released_qty: 0, id: "res-1" }, error: null };
  }
  return { data: null, error: null };
});

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
      if (relation === "b2b_order_availability") return makeQuery([]); // no available stock
      if (relation === "order_items") return makeQuery([demandRow]);
      if (relation === "production_jobs") return makeQuery([]);
      if (relation === "production_rgs_transfers") return makeQuery([]);
      if (relation === "inventory_reservations") return makeQuery([]);
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

function reserveCalls() {
  return rpcMock.mock.calls.filter(([fn]) => fn === "reserve_rgs_stock");
}
function shortageDemandCalls() {
  return rpcMock.mock.calls.filter(([fn]) => fn === "create_production_shortage_demand");
}

describe("ReadyGoodsStore shortage routing (reserve_rgs_stock)", () => {
  it("calls reserve_rgs_stock with the demand's order/product/sku/qty when a shortage row is allocated", async () => {
    render(<ReadyGoodsStore />);
    fireEvent.click(await screen.findByText("Rings (OAS-RIN-3)"));
    fireEvent.click(await screen.findByText("Allocate & route shortage"));

    await waitFor(() =>
      expect(reserveCalls()).toEqual([
        [
          "reserve_rgs_stock",
          expect.objectContaining({
            p_order_id: orderId,
            p_product_id: productId,
            p_sku: "OAS-RIN-3",
            p_requested_qty: 6,
            p_correlation_id: expect.any(String),
          }),
        ],
      ]),
    );
  });

  it("routes the full remaining shortage to production when RGS stock covers none of it", async () => {
    render(<ReadyGoodsStore />);
    fireEvent.click(await screen.findByText("Rings (OAS-RIN-3)"));
    fireEvent.click(await screen.findByText("Allocate & route shortage"));

    await waitFor(() =>
      expect(shortageDemandCalls()).toEqual([
        [
          "create_production_shortage_demand",
          expect.objectContaining({
            p_reservation_id: "res-1",
            p_department: "ARABIC_SWEETS",
            p_correlation_id: expect.any(String),
          }),
        ],
      ]),
    );
  });

  it("does not call create_production_shortage_demand if reserve_rgs_stock fails", async () => {
    // mockImplementationOnce would apply to whichever call happens first,
    // which is the mount-time emit_rgs_handover_escalations() ping, not
    // necessarily reserve_rgs_stock -- target the failure at the specific
    // RPC under test instead.
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "reserve_rgs_stock") return { data: null, error: { message: "Reservation rejected" } };
      return { data: null, error: null };
    });
    const { toast } = await import("sonner");
    render(<ReadyGoodsStore />);
    fireEvent.click(await screen.findByText("Rings (OAS-RIN-3)"));
    fireEvent.click(await screen.findByText("Allocate & route shortage"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Reservation rejected"));
    expect(shortageDemandCalls()).toHaveLength(0);
  });
});
