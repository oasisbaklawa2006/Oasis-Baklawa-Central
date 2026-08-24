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
  sku: "RIBBON-1",
  destination_store_code: "3PGS",
  shortage_qty: 6,
  fulfilled_qty: 0,
  vendor_reference: null,
  expected_at: null,
  status: "open",
};

const assemblyRequirementRow = {
  id: "assy-req-1",
  requirement_number: "PNA-000001:3PGS:comp-1:corr-1",
  sku: "RIBBON-1",
  source_store_code: "3PGS",
  requested_qty: 6,
  fulfilled_qty: 0,
  status: "open",
  priority: "normal",
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

let demandResult: unknown[] = [demandRow];
let procurementResult: unknown[] = [procurementRow];
let assemblyRequirementResult: unknown[] = [assemblyRequirementRow];
let reservationResult: unknown[] = [];
let issueEventResult: unknown[] = [];
let failNextFetch = false;

function makeQuery(result: { data: unknown; error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.in = () => builder;
  builder.eq = () => builder;
  builder.gt = () => builder;
  builder.limit = () => {
    if (failNextFetch) return Promise.resolve({ data: null, error: { message: "refresh failed" } });
    return Promise.resolve(result);
  };
  // inventory_reservations/rgs_issue_events queries terminate on the last
  // .eq()/.in()/.gt() call rather than .limit() -- make the builder itself
  // thenable so `await` on it resolves the same way.
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    if (failNextFetch) return Promise.resolve({ data: null, error: { message: "refresh failed" } }).then(resolve);
    return Promise.resolve(result).then(resolve);
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_3pgs_pending_demand_priority") return makeQuery({ data: demandResult, error: null });
      if (relation === "b2b_assembly_3pgs_requirements") return makeQuery({ data: assemblyRequirementResult, error: null });
      if (relation === "inventory_reservations") return makeQuery({ data: reservationResult, error: null });
      if (relation === "rgs_issue_events") return makeQuery({ data: issueEventResult, error: null });
      return makeQuery({ data: procurementResult, error: null });
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
  assemblyRequirementResult = [assemblyRequirementRow];
  reservationResult = [];
  issueEventResult = [];
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

  it("shows an empty state when there are no open P&A assembly requirements", async () => {
    assemblyRequirementResult = [];
    render(<ThreePgsProcurementQueue />);
    expect(await screen.findByText("No open P&A assembly requirements.")).toBeTruthy();
  });

  it("offers to reserve stock against an open assembly requirement, calling reserve_3pgs_requirement_stock", async () => {
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Reserve stock (6 outstanding)");
    fireEvent.click(button);

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("reserve_3pgs_requirement_stock", expect.objectContaining({
      p_requirement_id: "assy-req-1",
      p_priority: "normal",
    })));
  });

  it("does not offer to reserve stock once the full outstanding quantity is already reserved", async () => {
    reservationResult = [{ id: "resv-1", reservation_number: "resv-num-1", reserved_qty: 6, demand_reference: assemblyRequirementRow.requirement_number }];
    render(<ThreePgsProcurementQueue />);
    await screen.findAllByText(assemblyRequirementRow.requirement_number, { exact: false });
    expect(screen.queryByText(/Reserve stock \(/)).toBeNull();
  });

  it("offers to issue reserved stock, blocks an excessive quantity, and calls issue_3pgs_requirement_stock", async () => {
    reservationResult = [{ id: "resv-1", reservation_number: "resv-num-1", reserved_qty: 4, demand_reference: assemblyRequirementRow.requirement_number }];
    render(<ThreePgsProcurementQueue />);
    const input = await screen.findByPlaceholderText("Up to 4");
    const button = screen.getByText("Issue to P&A");

    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("issue_3pgs_requirement_stock", expect.objectContaining({
      p_requirement_id: "assy-req-1",
      p_reservation_id: "resv-1",
      p_issue_qty: 4,
    })));
  });

  it("offers to acknowledge a pending issue, blocks an excessive quantity, and calls acknowledge_3pgs_requirement_receipt", async () => {
    issueEventResult = [{ id: "issue-1", reservation_id: "resv-1", issued_qty: 4, issued_by: "user-a", destination_reference: assemblyRequirementRow.requirement_number }];
    render(<ThreePgsProcurementQueue />);
    const input = await screen.findByPlaceholderText("Up to 4");
    const button = screen.getByText("Acknowledge receipt");

    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("acknowledge_3pgs_requirement_receipt", expect.objectContaining({
      p_issue_event_id: "issue-1",
      p_received_qty: 4,
    })));
  });

  it("limits an issue to the unissued reservation balance when an issue event already exists", async () => {
    reservationResult = [{ id: "resv-1", reservation_number: "resv-num-1", reserved_qty: 4, demand_reference: assemblyRequirementRow.requirement_number }];
    issueEventResult = [{ id: "issue-1", reservation_id: "resv-1", issued_qty: 4, issued_by: "user-a", destination_reference: assemblyRequirementRow.requirement_number }];
    render(<ThreePgsProcurementQueue />);
    const input = await screen.findByPlaceholderText("Up to 0");
    const button = screen.getByText("Issue to P&A");

    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalledWith("issue_3pgs_requirement_stock", expect.anything()));
  });

  it("blocks acknowledging receipt with a blank or zero quantity", async () => {
    issueEventResult = [{ id: "issue-1", reservation_id: "resv-1", issued_qty: 4, issued_by: "user-a", destination_reference: assemblyRequirementRow.requirement_number }];
    render(<ThreePgsProcurementQueue />);
    const button = await screen.findByText("Acknowledge receipt");

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Up to 4");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).not.toHaveBeenCalled());
  });

  it("reuses the correlation id for an issue retry with the same quantity, and mints a fresh one when the quantity changes", async () => {
    reservationResult = [{ id: "resv-1", reservation_number: "resv-num-1", reserved_qty: 4, demand_reference: assemblyRequirementRow.requirement_number }];
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<ThreePgsProcurementQueue />);
    const input = await screen.findByPlaceholderText("Up to 4");
    const button = screen.getByText("Issue to P&A");

    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgsSameQty] = rpcMock.mock.calls[1];
    expect(secondArgsSameQty.p_correlation_id).toBe(firstArgs.p_correlation_id);

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(3));
    const [, thirdArgsDifferentQty] = rpcMock.mock.calls[2];
    expect(thirdArgsDifferentQty.p_correlation_id).not.toBe(secondArgsSameQty.p_correlation_id);
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
});
