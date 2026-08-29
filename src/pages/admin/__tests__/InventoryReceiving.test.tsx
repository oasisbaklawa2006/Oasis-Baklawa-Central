import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InventoryReceiving from "../InventoryReceiving";

const receiptRow = {
  id: "receipt-1",
  receipt_number: "RCPT-0001",
  receipt_source: "vendor_delivery",
  destination_store_code: "STORE-1",
  source_document_type: "po",
  source_document_reference: "PO-9001",
  status: "partially_accepted",
  received_at: "2026-08-20T00:00:00.000Z",
  created_at: "2026-08-20T00:00:00.000Z",
};

const lineRow = {
  id: "line-1",
  receipt_id: "receipt-1",
  sku: "SKU-BAKLAWA-1KG",
  supplier_batch_lot: "SUP-LOT-1",
  oasis_batch_lot: null,
  expiry_date: null,
  expected_qty: 10,
  received_qty: 10,
  accepted_qty: 8,
  damaged_qty: 2,
  rejected_qty: 0,
  shortage_qty: 0,
  excess_qty: 0,
};

const ambientBin = { id: "bin-ambient", store_code: "STORE-1", zone_code: "Z1", rack_code: "R1", shelf_code: "S1", bin_code: "B1", storage_class: "ambient", active: true };
const damagedBin = { id: "bin-damaged", store_code: "STORE-1", zone_code: "Z2", rack_code: "R2", shelf_code: "S2", bin_code: "B2", storage_class: "damaged", active: true };

const discrepancyRow = {
  id: "disc-1",
  receipt_line_id: "line-1",
  discrepancy_type: "damaged",
  quantity: 2,
  status: "open",
  resolution: null,
  resolved_at: null,
  created_at: "2026-08-20T00:00:00.000Z",
};

let receiptResult: unknown[] = [receiptRow];
let lineResult: unknown[] = [lineRow];
let taskResult: unknown[] = [];
let grnResult: unknown[] = [];
let binResult: unknown[] = [ambientBin, damagedBin];
let discrepancyResult: unknown[] = [discrepancyRow];
let failRelation: string | null = null;

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: null, error: null as { message: string } | null }));

function makeQuery(relation: string, data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  const resolve = () => (failRelation === relation ? { data: null, error: { message: `${relation} fetch failed` } } : { data, error: null });
  builder.select = () => builder;
  builder.order = () => builder;
  builder.in = () => builder;
  builder.eq = () => builder;
  builder.limit = () => Promise.resolve(resolve());
  builder.then = (onResolve: (value: { data: unknown; error: unknown }) => void) => Promise.resolve(resolve()).then(onResolve);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_inventory_receipts") return makeQuery(relation, receiptResult);
      if (relation === "b2b_inventory_receipt_lines") return makeQuery(relation, lineResult);
      if (relation === "b2b_inventory_putaway_tasks") return makeQuery(relation, taskResult);
      if (relation === "b2b_inventory_grns") return makeQuery(relation, grnResult);
      if (relation === "b2b_inventory_bins") return makeQuery(relation, binResult);
      if (relation === "b2b_supplier_discrepancies") return makeQuery(relation, discrepancyResult);
      return makeQuery(relation, []);
    },
    rpc: (fn: string, args: Record<string, unknown>) => rpcMock(fn, args),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  receiptResult = [receiptRow];
  lineResult = [lineRow];
  taskResult = [];
  grnResult = [];
  binResult = [ambientBin, damagedBin];
  discrepancyResult = [discrepancyRow];
  failRelation = null;
});

describe("InventoryReceiving put-away allocation", () => {
  it("surfaces an allocation slot for every unallocated disposition quantity, restricted to storage-class-eligible bins", async () => {
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    expect(await screen.findByText("Put-away allocation required")).toBeTruthy();
    expect(screen.getByLabelText(`Bin for ${lineRow.sku} accepted`)).toBeTruthy();
    expect(screen.getByLabelText(`Bin for ${lineRow.sku} damaged`)).toBeTruthy();
    const acceptedOptions = within(screen.getByLabelText(`Bin for ${lineRow.sku} accepted`)).getAllByRole("option");
    expect(acceptedOptions.some((option) => option.textContent?.includes("B1"))).toBe(true);
    expect(acceptedOptions.some((option) => option.textContent?.includes("B2"))).toBe(false);
    const damagedOptions = within(screen.getByLabelText(`Bin for ${lineRow.sku} damaged`)).getAllByRole("option");
    expect(damagedOptions.some((option) => option.textContent?.includes("B2"))).toBe(true);
    expect(damagedOptions.some((option) => option.textContent?.includes("B1"))).toBe(false);
  });

  it("calls allocate_b2b_inventory_putaway with the exact receipt, bin, disposition, and quantity once every slot is filled", async () => {
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Put-away allocation required");
    fireEvent.change(screen.getByLabelText(`Bin for ${lineRow.sku} accepted`), { target: { value: ambientBin.id } });
    fireEvent.change(screen.getByLabelText(`Bin for ${lineRow.sku} damaged`), { target: { value: damagedBin.id } });
    fireEvent.click(screen.getByRole("button", { name: "Allocate put-away" }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith(
      "allocate_b2b_inventory_putaway",
      expect.objectContaining({
        p_receipt_id: "receipt-1",
        p_allocations: expect.arrayContaining([
          { line_id: "line-1", bin_id: ambientBin.id, disposition: "accepted", quantity: 8 },
          { line_id: "line-1", bin_id: damagedBin.id, disposition: "damaged", quantity: 2 },
        ]),
      }),
    ));
  });

  it("blocks submission with a visible message when a slot has no bin selected, and never calls the RPC", async () => {
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Put-away allocation required");
    fireEvent.click(screen.getByRole("button", { name: "Allocate put-away" }));
    expect(await screen.findByText("Select a bin for every open allocation before submitting.")).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("keeps the allocation action visibly actionable and does not fabricate success when the RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Disposition and bin storage class mismatch" } });
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Put-away allocation required");
    fireEvent.change(screen.getByLabelText(`Bin for ${lineRow.sku} accepted`), { target: { value: ambientBin.id } });
    fireEvent.change(screen.getByLabelText(`Bin for ${lineRow.sku} damaged`), { target: { value: damagedBin.id } });
    fireEvent.click(screen.getByRole("button", { name: "Allocate put-away" }));

    expect(await screen.findByText("Disposition and bin storage class mismatch")).toBeTruthy();
    // The panel must remain -- a failed RPC call must not clear the pending slots
    // or otherwise render a false "complete" state.
    expect(screen.getByText("Put-away allocation required")).toBeTruthy();
  });

  it("no longer shows a slot once its disposition is already fully allocated by an existing task", async () => {
    taskResult = [{ id: "task-1", receipt_line_id: "line-1", bin_id: ambientBin.id, disposition: "accepted", allocated_qty: 8, placed_qty: 0, status: "pending", b2b_inventory_bins: { bin_code: "B1", store_code: "STORE-1", zone_code: "Z1", rack_code: "R1", shelf_code: "S1" } }];
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Put-away & GRN");
    expect(screen.queryByLabelText(`Bin for ${lineRow.sku} accepted`)).toBeNull();
    expect(screen.getByLabelText(`Bin for ${lineRow.sku} damaged`)).toBeTruthy();
  });
});

describe("InventoryReceiving supplier discrepancy workspace", () => {
  it("loads discrepancies from the canonical authority and marks an open discrepancy as visually distinct from a resolved one", async () => {
    discrepancyResult = [
      discrepancyRow,
      { id: "disc-2", receipt_line_id: "line-1", discrepancy_type: "shortage", quantity: 1, status: "resolved", resolution: "Credit issued by supplier", resolved_at: "2026-08-21T00:00:00.000Z", created_at: "2026-08-20T00:00:00.000Z" },
    ];
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    const section = (await screen.findByText("Supplier discrepancies")).closest("section") as HTMLElement;
    const openBadge = within(section).getByText("open", { selector: "div" });
    const resolvedBadge = within(section).getByText("resolved", { selector: "div" });
    expect(openBadge.className).not.toEqual(resolvedBadge.className);
    expect(screen.getByText(/Credit issued by supplier/)).toBeTruthy();
  });

  it("does not offer a resolution action for an already-resolved discrepancy", async () => {
    discrepancyResult = [{ ...discrepancyRow, status: "resolved", resolution: "Waived", resolved_at: "2026-08-21T00:00:00.000Z" }];
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Supplier discrepancies");
    expect(screen.queryByLabelText(`Resolution notes for ${discrepancyRow.discrepancy_type}`)).toBeNull();
  });

  it("requires resolution notes before resolving, and never infers resolution from mere interaction", async () => {
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Supplier discrepancies");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter resolution notes before submitting.")).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls resolve_b2b_supplier_discrepancy with the exact discrepancy id, resolution text, and chosen status", async () => {
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Supplier discrepancies");
    fireEvent.change(screen.getByLabelText(`Resolution notes for ${discrepancyRow.discrepancy_type}`), { target: { value: "Supplier issued a replacement batch" } });
    fireEvent.change(screen.getByLabelText(`Resolution status for ${discrepancyRow.discrepancy_type}`), { target: { value: "replacement_due" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith("resolve_b2b_supplier_discrepancy", {
      p_discrepancy_id: "disc-1",
      p_resolution: "Supplier issued a replacement batch",
      p_status: "replacement_due",
    }));
  });

  it("keeps the discrepancy visibly open when the resolve RPC fails, rather than rendering a false resolved state", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Not authorised" } });
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    await screen.findByText("Supplier discrepancies");
    fireEvent.change(screen.getByLabelText(`Resolution notes for ${discrepancyRow.discrepancy_type}`), { target: { value: "Attempted resolution" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Not authorised")).toBeTruthy();
    const section = screen.getByText("Supplier discrepancies").closest("section") as HTMLElement;
    expect(within(section).getByText("open")).toBeTruthy();
  });

  it("does not render a false empty state when the discrepancy fetch itself fails", async () => {
    failRelation = "b2b_supplier_discrepancies";
    render(<MemoryRouter><InventoryReceiving /></MemoryRouter>);
    expect(await screen.findByText(/Receiving contract could not be read/)).toBeTruthy();
    expect(screen.queryByText("Supplier discrepancies")).toBeNull();
    expect(screen.queryByText("Put-away allocation required")).toBeNull();
  });
});
