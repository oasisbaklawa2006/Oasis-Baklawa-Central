import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import ThreePgsProcurementQueue, { RECEIVING_CORRELATION_STORAGE_KEY } from "../ThreePgsProcurementOperator";

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
let assemblyRequirementResult: unknown[] = [assemblyRequirementRow];
let reservationResult: unknown[] = [];
let issueEventResult: unknown[] = [];
let failNextFetch = false;

function makeQuery(result: { data: unknown; error: null }, options: { respectFailNextFetch?: boolean } = {}) {
  const respectFailNextFetch = options.respectFailNextFetch ?? true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.in = () => builder;
  builder.eq = () => builder;
  builder.gt = () => builder;
  builder.limit = () => {
    const resolved = respectFailNextFetch && failNextFetch ? { data: null, error: { message: "refresh failed" } } : result;
    const promise = Promise.resolve(resolved);
    // @ts-expect-error -- test-only chainable promise, see maybeSingle usage below
    promise.maybeSingle = () => Promise.resolve(resolved);
    return promise;
  };
  // inventory_reservations/rgs_issue_events queries terminate on the last
  // .eq()/.in()/.gt() call rather than .limit() -- make the builder itself
  // thenable so `await` on it resolves the same way.
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    if (respectFailNextFetch && failNextFetch) return Promise.resolve({ data: null, error: { message: "refresh failed" } }).then(resolve);
    return Promise.resolve(result).then(resolve);
  };
  builder.maybeSingle = () => Promise.resolve(result);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_3pgs_pending_demand_priority") return makeQuery({ data: demandResult, error: null });
      if (relation === "b2b_assembly_3pgs_requirements") return makeQuery({ data: assemblyRequirementResult, error: null });
      if (relation === "inventory_reservations") return makeQuery({ data: reservationResult, error: null });
      if (relation === "rgs_issue_events") return makeQuery({ data: issueEventResult, error: null });
      if (relation === "b2b_procurement_requirements") return makeQuery({ data: procurementResult, error: null });
      // These two are read mid-flow by handleReceive itself (to resolve the
      // receipt line and the current stock-balance version), not by the
      // post-action fetchData() refresh -- failNextFetch simulates only the
      // refresh failing, so these must stay unaffected by it.
      if (relation === "b2b_inventory_receipt_lines") return makeQuery({ data: receiptLineRow, error: null }, { respectFailNextFetch: false });
      if (relation === "inventory_stock_balances") return makeQuery({ data: balanceRow, error: null }, { respectFailNextFetch: false });
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
  window.sessionStorage.clear();
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
      // Core PR #129's canonical supplier receipt vocabulary -- no fake
      // supplier UUID, the procurement requirement is the source document.
      p_receipt_source: "supplier",
      p_source_document_type: "procurement_requirement",
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

    // The same receipt correlation id must carry across create, record and
    // accept; the link correlation is a separate, still-stable id.
    const receiptCorrelationId = calls[0][1].p_correlation_id;
    expect(calls[1][1].p_correlation_id).toBe(receiptCorrelationId);
    expect(calls[2][1].p_correlation_id).toBe(receiptCorrelationId);
    expect(calls[3][1].p_correlation_id).not.toBe(receiptCorrelationId);
  });

  it("credits procurement fulfilment by accepted quantity, never received quantity, when part of a delivery is damaged or rejected", async () => {
    render(<ThreePgsProcurementQueue />);
    await screen.findByText("Receive");
    fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Accepted quantity"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Damaged quantity"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Rejected quantity"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Receive"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
    const calls = rpcMock.mock.calls;
    expect(calls[1][1]).toMatchObject({ p_lines: [{ line_id: "line-1", received_qty: 6 }] });
    expect(calls[2][1]).toMatchObject({
      p_lines: [{ line_id: "line-1", accepted_qty: 4, damaged_qty: 1, rejected_qty: 1 }],
    });
    expect(calls[3][0]).toBe("link_procurement_receipt");
    expect(calls[3][1]).toMatchObject({ p_fulfilled_qty: 4 });
  });

  it("leaves a fully damaged/rejected receipt unlinked so the procurement shortage stays open", async () => {
    render(<ThreePgsProcurementQueue />);
    await screen.findByText("Receive");
    fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Accepted quantity"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Damaged quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Rejected quantity"), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Receive"));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(3));
    expect(rpcMock.mock.calls[0][0]).toBe("create_b2b_inventory_receipt");
    expect(rpcMock.mock.calls[1][0]).toBe("record_b2b_inventory_receipt");
    expect(rpcMock.mock.calls[2][0]).toBe("accept_b2b_inventory_receipt");
    expect(rpcMock).not.toHaveBeenCalledWith("link_procurement_receipt", expect.anything());
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

  describe("receiving correlation persistence across reload", () => {
    it("reuses the same receipt correlation after a simulated page reload when the prior attempt never confirmed completion", async () => {
      const first = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await first.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      failNextFetch = true;
      fireEvent.click(first.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      const firstCorrelationId = rpcMock.mock.calls[0][1].p_correlation_id;
      // The post-action refresh failed, so the ref was never cleared -- but a
      // real reload destroys the in-memory ref regardless. Unmounting and
      // mounting fresh simulates exactly that; only sessionStorage bridges it.
      first.unmount();

      failNextFetch = false;
      const second = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await second.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(second.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(8));

      const secondCorrelationId = rpcMock.mock.calls[4][1].p_correlation_id;
      expect(secondCorrelationId).toBe(firstCorrelationId);
      expect(rpcMock.mock.calls[4][0]).toBe("create_b2b_inventory_receipt");
    });

    it("clears the persisted correlation after authoritative success, so a later genuinely new receipt gets a fresh id", async () => {
      const first = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await first.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(first.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      const firstCorrelationId = rpcMock.mock.calls[0][1].p_correlation_id;
      await waitFor(() => expect(window.sessionStorage.getItem(RECEIVING_CORRELATION_STORAGE_KEY)).not.toContain(firstCorrelationId));
      first.unmount();

      const second = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await second.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(second.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(8));

      const secondCorrelationId = rpcMock.mock.calls[4][1].p_correlation_id;
      expect(secondCorrelationId).not.toBe(firstCorrelationId);
    });

    it("blocks a changed payload from reusing an unresolved persisted correlation after reload", async () => {
      const first = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await first.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      failNextFetch = true;
      fireEvent.click(first.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      first.unmount();

      failNextFetch = false;
      const second = render(<ThreePgsProcurementQueue />);
      fireEvent.change(await second.findByPlaceholderText("Qty (of 6)"), { target: { value: "5" } });
      fireEvent.click(second.getByText("Receive"));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
        "A previous receive attempt is pending. Restore the original receipt quantities or refresh after reconciliation before changing the disposition.",
      ));
      expect(rpcMock).toHaveBeenCalledTimes(4);
    });

    it("clears the pending correlation when create fails validation, so a corrected resubmission is not blocked", async () => {
      rpcMock.mockImplementationOnce(async () => ({
        data: null,
        error: { message: "expected_qty exceeds outstanding shortage" },
      }));
      render(<ThreePgsProcurementQueue />);
      fireEvent.change(await screen.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(screen.getByText("Receive"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("expected_qty exceeds outstanding shortage"));
      expect(rpcMock).toHaveBeenCalledTimes(1);

      // No receipt was ever created, so the reserved correlation must not
      // survive to block a corrected resubmission with different quantities.
      fireEvent.change(screen.getByPlaceholderText("Qty (of 6)"), { target: { value: "3" } });
      fireEvent.click(screen.getByText("Receive"));

      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(5));
      expect(rpcMock.mock.calls[1][0]).toBe("create_b2b_inventory_receipt");
      expect(toast.error).not.toHaveBeenCalledWith(
        "A previous receive attempt is pending. Restore the original receipt quantities or refresh after reconciliation before changing the disposition.",
      );
    });

    it("treats malformed persisted state as absent and still completes a receive", async () => {
      window.sessionStorage.setItem(RECEIVING_CORRELATION_STORAGE_KEY, "{not json");
      render(<ThreePgsProcurementQueue />);
      fireEvent.change(await screen.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(screen.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      expect(rpcMock.mock.calls[0][0]).toBe("create_b2b_inventory_receipt");
    });

    it("treats an expired persisted correlation as stale and mints a fresh one rather than reusing it", async () => {
      window.sessionStorage.setItem(RECEIVING_CORRELATION_STORAGE_KEY, JSON.stringify({
        "proc-1": {
          receiptCorrelationId: "11111111-1111-1111-1111-111111111111",
          linkCorrelationId: "22222222-2222-2222-2222-222222222222",
          payloadFingerprint: "stale",
          storedAt: Date.now() - 25 * 60 * 60 * 1000,
        },
      }));
      render(<ThreePgsProcurementQueue />);
      fireEvent.change(await screen.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(screen.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      expect(rpcMock.mock.calls[0][1].p_correlation_id).not.toBe("11111111-1111-1111-1111-111111111111");
    });

    it("ignores a persisted entry with the wrong shape rather than granting it authority", async () => {
      window.sessionStorage.setItem(RECEIVING_CORRELATION_STORAGE_KEY, JSON.stringify({
        "proc-1": { receiptCorrelationId: 12345, linkCorrelationId: null, payloadFingerprint: "x" },
      }));
      render(<ThreePgsProcurementQueue />);
      fireEvent.change(await screen.findByPlaceholderText("Qty (of 6)"), { target: { value: "4" } });
      fireEvent.click(screen.getByText("Receive"));
      await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(4));
      expect(typeof rpcMock.mock.calls[0][1].p_correlation_id).toBe("string");
    });
  });
});