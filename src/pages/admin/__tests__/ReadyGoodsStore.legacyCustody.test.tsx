import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ReadyGoodsStore from "../ReadyGoodsStore";

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  fake: null as { from: (r: string) => unknown } | null,
  failReservationsAtPage: null as number | null,
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: null, error: null as { message: string } | null })),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { makeKeysetFakeDb } = await import("@/lib/rgs/__tests__/keysetFakeDb");
  return {
    supabase: {
      from: (relation: string) => {
        if (relation === "b2b_order_availability" || relation === "inventory_stock_balances") {
          const b: Record<string, unknown> = {};
          b.select = () => b; b.eq = () => b; b.maybeSingle = () => Promise.resolve({ data: null, error: null });
          b.order = () => Promise.resolve({ data: [], error: null });
          return b;
        }
        // One fake per test so its per-relation page counter spans the whole load.
        h.fake ??= makeKeysetFakeDb(h.tables, ({ relation: r, index }) =>
          r === "inventory_reservations" && h.failReservationsAtPage === index
            ? { data: null, error: { message: "page timeout" } } : undefined).db;
        return h.fake.from(relation);
      },
    },
  };
});
vi.mock("@/lib/rgsGovernedRpc", () => ({ rgsGovernedRpc: { rpc: (...a: unknown[]) => h.rpc(...(a as [string, Record<string, unknown>])) } }));
vi.mock("@/lib/production-lifecycle", () => ({ productionGovernedRpc: { createShortageDemand: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const orderId = "order-1", productId = "product-1";
const line = {
  id: "line-1", order_id: orderId, product_id: productId, quantity: 10, actual_packed_qty: 0, production_status: null, department: null,
  product: { id: productId, name: "Widget", sku: "WIDGET-1", production_department: "FACTORY" },
};
const reservation = (n: number, over: Record<string, unknown> = {}) => ({
  id: `res-${String(n).padStart(5, "0")}`, order_id: orderId, product_id: productId, sku: "WIDGET-1",
  requested_qty: 10, reserved_qty: 4, fulfilled_qty: 0, released_qty: 0, reservation_status: "partially_reserved",
  location_code: "FINISHED_GOODS", demand_reference: null, created_at: `2026-08-01T00:00:${String(n % 60).padStart(2, "0")}.${String(n).padStart(6, "0")}+00:00`, ...over,
});

beforeEach(() => {
  h.fake = null;
  h.failReservationsAtPage = null;
  h.tables = {
    orders: [{ id: orderId, status: "approved", created_at: "2026-08-01T00:00:00+00:00", company: { business_name: "Acme" }, order_items: [line] }],
    production_jobs: [], production_rgs_transfers: [], rgs_issue_events: [], inventory_reservations: [],
  };
});
afterEach(() => vi.clearAllMocks());

describe("ReadyGoodsStore governed legacy custody queue", () => {
  it("lists an unresolved legacy reservation separately, never attaches it to the order line, and keeps governed controls", async () => {
    h.tables.inventory_reservations = [reservation(1, { id: "legacy-res-1" })];
    render(<ReadyGoodsStore />);
    const queue = await screen.findByTestId("rgs-legacy-custody-queue");
    expect(within(queue).getByText(/Reservation LEGACY-R/i)).toBeTruthy();
    expect(within(queue).getByText(/reference missing/)).toBeTruthy();

    // The sales-order line gets no borrowed reservation and allocation stays blocked.
    expect(screen.getByText("No RGS stock reservation exists yet for this demand.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Allocate & route shortage/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("rgs-allocation-blocked-reason").textContent).toMatch(/Legacy custody reconciliation/);

    fireEvent.change(within(queue).getByPlaceholderText("Release qty"), { target: { value: "2" } });
    fireEvent.change(within(queue).getByPlaceholderText("Reason (e.g. order_cancelled)"), { target: { value: "legacy_reconciled" } });
    fireEvent.click(within(queue).getByText("Release"));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("release_rgs_reservation", expect.objectContaining({
      p_reservation_id: "legacy-res-1", p_release_qty: 2, p_reason_code: "legacy_reconciled",
    })));
    expect(h.rpc.mock.calls.some(([fn]) => fn === "reserve_rgs_stock")).toBe(false);
  });

  it("ignores terminal and zero-qty legacy reservations (no queue, no allocation block)", async () => {
    h.tables.inventory_reservations = [
      reservation(1, { id: "t-released", reservation_status: "released", reserved_qty: 0 }),
      reservation(2, { id: "t-fulfilled", reservation_status: "fulfilled", reserved_qty: 3 }),
      reservation(3, { id: "t-cancelled", reservation_status: "cancelled" }),
      reservation(4, { id: "t-expired", reservation_status: "expired" }),
      reservation(5, { id: "z-zero", reserved_qty: 0 }),
    ];
    render(<ReadyGoodsStore />);
    await screen.findByText("Allocate & route shortage");
    expect(screen.queryByTestId("rgs-legacy-custody-queue")).toBeNull();
    expect((screen.getByRole("button", { name: /Allocate & route shortage/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("finds a legacy reservation beyond the old 500-row cap", async () => {
    const rows = Array.from({ length: 619 }, (_, i) => reservation(i, { id: `anchored-${String(i).padStart(5, "0")}`, demand_reference: "order_item:other-line", reservation_status: "released", reserved_qty: 0 }));
    rows.push(reservation(900, { id: "legacy-late" }));
    h.tables.inventory_reservations = rows.reverse();
    render(<ReadyGoodsStore />);
    const queue = await screen.findByTestId("rgs-legacy-custody-queue");
    expect(within(queue).getByText(/Reservation LEGACY-L/i)).toBeTruthy();
  });

  it("fails closed: an unreadable later page shows the error and exposes no custody or allocation controls", async () => {
    h.tables.inventory_reservations = Array.from({ length: 600 }, (_, i) => reservation(i, { id: `r-${String(i).padStart(5, "0")}` }));
    h.failReservationsAtPage = 1;
    render(<ReadyGoodsStore />);
    await screen.findByText(/RGS contracts could not be read/);
    expect(screen.getByText(/page timeout/)).toBeTruthy();
    expect(screen.queryByText("Release")).toBeNull();
    expect(screen.queryByText("Allocate & route shortage")).toBeNull();
    expect(screen.queryByTestId("rgs-legacy-custody-queue")).toBeNull();
  });
});
