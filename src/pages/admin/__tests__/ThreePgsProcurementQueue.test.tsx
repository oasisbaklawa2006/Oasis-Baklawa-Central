import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThreePgsProcurementQueue from "../ThreePgsProcurementQueue";

const demandRow = {
  demand_source_type: "pna" as const,
  priority_rank: 1,
  demand_id: "req-1",
  demand_reference: "PNA-000001:3PGS:comp-1:corr-1",
  product_id: "prod-1",
  sku: "RIBBON-1",
  location_code: "3PGS",
  outstanding_qty: 6,
  priority: "normal",
  created_at: "2026-08-22T00:00:00.000Z",
};

const procurementRow = {
  id: "proc-1",
  requirement_number: "PNA-000001:3PGS:comp-1:corr-1:PROC:corr-2",
  product_id: "prod-1",
  sku: "RIBBON-1",
  destination_store_code: "3PGS",
  shortage_qty: 6,
  fulfilled_qty: 0,
  vendor_reference: null,
  expected_at: null,
  status: "open",
};

const receiptLineRow = { id: "line-1", product_id: "prod-1", sku: "RIBBON-1" };
const balanceRow = { version: 2 };

const rpcMock = vi.fn(async (fn: string, _args: Record<string, unknown>) => {
  if (fn === "create_b2b_inventory_receipt") {
    return { data: { id: "receipt-1", status: "expected", destination_store_code: "3PGS" }, error: null };
  }
  return { data: null, error: null as { message: string } | null };
});

let demandResult: unknown[] = [demandRow];
let procurementResult: unknown[] = [procurementRow];
let failNextFetch = false;

function makeQuery(result: { data: unknown; error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.eq = () => builder;
  builder.limit = () => {
    const resolved = failNextFetch ? { data: null, error: { message: "refresh failed" } } : result;
    const promise = Promise.resolve(resolved);
    // @ts-expect-error -- test-only chainable promise, see maybeSingle usage below
    promise.maybeSingle = () => Promise.resolve(resolved);
    return promise;
  };
  builder.maybeSingle = () => Promise.resolve(result);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_3pgs_pending_demand_priority") return makeQuery({ data: demandResult, error: null });
      if (relation === "b2b_procurement_requirements") return makeQuery({ data: procurementResult, error: null });
      if (relation === "b2b_inventory_receipt_lines") return makeQuery({ data: receiptLineRow, error: null });
      if (relation === "inventory_stock_balances") return makeQuery({ data: balanceRow, error: null });
      return makeQuery({ data: null, error: null });
    },
  },
}));

vi.mock("@/lib/threePgsProcurementRpc", () => ({
  threePgsProcurementRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  demandResult = [demandRow];
  procurementResult = [procurementRow];
  failNextFetch = false;
});

describe("ThreePgsProcurementQueue", () => {
  it("renders pending demand and existing procurement requirements", async () => {
    render(<ThreePgsProcurementQueue />);
    expect(await screen.findByText("RIBBON-1")).toBeTruthy();
    expect(screen.getByText(procurementRow.requirement_number, { exact: false })).toBeTruthy();
  });

  it("shows an empty state when there is no pending demand", async () => {
    demandResult = [];
    render(<ThreePgsProcurementQueue />);
    expect(await screen.findByText("No pending demand.")).toBeTruthy();
  });

  it("raises a procurement requirement with the real outstanding quantity and source mapping, reusing the correlation id on retry", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Raise procurement requirement");

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [firstFn, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(firstFn).toBe("create_procurement_requirement");
    expect(firstArgs).toMatchObject({
      p_source_type: "assembly_3pgs_requirement",
      p_source_reference: demandRow.demand_reference,
      p_product_id: "prod-1",
      p_sku: "RIBBON-1",
      p_destination_store_code: "3PGS",
      p_shortage_qty: 6,
    });
    expect(secondArgs.p_correlation_id).toBe(firstArgs.p_correlation_id);
  });

  it("keeps the same correlation id for a retry when the RPC succeeds but the post-action refresh fails", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Raise procurement requirement");

    failNextFetch = true;
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    // The RPC succeeded but the subsequent refresh failed -- the row must
    // stay actionable and a retry must reuse the same correlation id rather
    // than generating a new one (which would replay the accepted RPC as a
    // fresh, un-deduplicated call).
    await waitFor(() => expect(screen.getByText("Failed to load the 3PGS procurement queue.")).toBeTruthy());

    failNextFetch = false;
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(secondArgs.p_correlation_id).toBe(firstArgs.p_correlation_id);
  });

  it("blocks vendor assignment without a vendor reference", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Assign vendor");
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("assigns a vendor with the entered reference", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Assign vendor");
    fireEvent.change(screen.getByPlaceholderText("Vendor reference"), { target: { value: "Acme Packaging" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("assign_procurement_vendor", expect.objectContaining({
      p_requirement_id: "proc-1",
      p_vendor_reference: "Acme Packaging",
    })));
  });

  it("blocks receiving with no quantity entered", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Receive");
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("blocks receiving a quantity larger than the outstanding shortage", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Receive");
    fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "10" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("receives a quantity by driving create -> record -> accept -> link in order with the right arguments", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Receive");
    fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));

    const calls = rpcMock.mock.calls;
    expect(calls[0][0]).toBe("create_b2b_inventory_receipt");
    expect(calls[0][1]).toMatchObject({
      p_destination_store_code: "3PGS",
      p_lines: [{ product_id: "prod-1", sku: "RIBBON-1", expected_qty: 4 }],
    });
    expect(calls[1][0]).toBe("record_b2b_inventory_receipt");
    expect(calls[1][1]).toMatchObject({
      p_receipt_id: "receipt-1",
      p_lines: [{ line_id: "line-1", received_qty: 4 }],
    });
    expect(calls[2][0]).toBe("accept_b2b_inventory_receipt");
    expect(calls[2][1]).toMatchObject({
      p_receipt_id: "receipt-1",
      p_lines: [{ line_id: "line-1", accepted_qty: 4, damaged_qty: 0, rejected_qty: 0, expected_balance_version: 2 }],
    });
    expect(calls[3][0]).toBe("link_procurement_receipt");
    expect(calls[3][1]).toMatchObject({
      p_requirement_id: "proc-1",
      p_receipt_id: "receipt-1",
      p_fulfilled_qty: 4,
    });
  });

  it("skips record/accept and only links when the receipt already reached an accepted status (idempotent retry)", async () => {
    rpcMock.mockImplementationOnce(async () => ({
      data: { id: "receipt-1", status: "accepted", destination_store_code: "3PGS" },
      error: null,
    }));
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Receive");
    fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    expect(rpcMock.mock.calls[0][0]).toBe("create_b2b_inventory_receipt");
    expect(rpcMock.mock.calls[1][0]).toBe("link_procurement_receipt");
  });
});
