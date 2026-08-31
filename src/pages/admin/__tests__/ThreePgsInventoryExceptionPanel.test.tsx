import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThreePgsInventoryExceptionPanel from "../ThreePgsInventoryExceptionPanel";

const line = { id: "line-1", product_id: "product-1", sku: "PKG-BOX-1" };
const balance = { product_id: "product-1", sku: "PKG-BOX-1", available_qty: 12, quarantine_qty: 4 };
let rpcResponses: Array<{ data: unknown; error: { message: string } | null }> = [];
const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => rpcResponses.shift() ?? { data: null, error: null });

function query(data: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => void) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => relation === "b2b_inventory_receipt_lines" ? query([line]) : relation === "inventory_stock_balances" ? query([balance]) : query([]),
    rpc: (fn: string, args: Record<string, unknown>) => rpcMock(fn, args),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  rpcResponses = [];
});

describe("ThreePgsInventoryExceptionPanel", () => {
  it("does not expose 3PGS exception controls on another store", () => {
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="FINISHED_GOODS" grnFinalisedAt="2026-09-01T00:00:00Z" reloadParent={vi.fn(async () => undefined)} />);
    expect(screen.queryByTestId("3pgs-inventory-exception-panel")).toBeNull();
  });

  it("keeps post-GRN mutation disabled until the GRN is finalised", () => {
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="3PGS" grnFinalisedAt={null} reloadParent={vi.fn(async () => undefined)} />);
    expect(screen.getByText("Post-GRN 3PGS exceptions")).toBeTruthy();
    expect(screen.getByText(/only after the GRN is finalised/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
  });

  it("calls only the governed Core RPC with the exact stock identity and forced quarantine source", async () => {
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="3PGS" grnFinalisedAt="2026-09-01T00:00:00Z" reloadParent={vi.fn(async () => undefined)} />);
    await screen.findByText("Available 12");
    expect(screen.getByLabelText(`Source bucket for ${line.sku}`)).toBeDisabled();
    fireEvent.change(screen.getByLabelText(`Exception quantity for ${line.sku}`), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(`Exception reason for ${line.sku}`), { target: { value: "QC hold" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    expect(rpcMock).toHaveBeenCalledWith("record_b2b_3pgs_inventory_exception", expect.objectContaining({
      p_product_id: "product-1",
      p_sku: "PKG-BOX-1",
      p_action: "quarantine",
      p_source_bucket: "available",
      p_quantity: 3,
      p_reason: "QC hold",
      p_evidence: [],
    }));
  });

  it("reuses the same correlation id when an unchanged command is retried after an RPC error", async () => {
    rpcResponses = [{ data: null, error: { message: "network uncertainty" } }, { data: null, error: null }];
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="3PGS" grnFinalisedAt="2026-09-01T00:00:00Z" reloadParent={vi.fn(async () => undefined)} />);
    await screen.findByText("Available 12");
    fireEvent.change(screen.getByLabelText(`Exception quantity for ${line.sku}`), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(`Exception reason for ${line.sku}`), { target: { value: "Damaged outer carton" } });
    fireEvent.change(screen.getByLabelText(`Exception action for ${line.sku}`), { target: { value: "damage_writeoff" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText("network uncertainty")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    const first = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    const second = rpcMock.mock.calls[1][1] as Record<string, unknown>;
    expect(first.p_correlation_id).toBe(second.p_correlation_id);
  });

  it("treats Core success as committed even when the parent refresh fails, and does not leave the old command retryable", async () => {
    const reloadParent = vi.fn(async () => { throw new Error("parent refresh unavailable"); });
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="3PGS" grnFinalisedAt="2026-09-01T00:00:00Z" reloadParent={reloadParent} />);
    await screen.findByText("Available 12");
    fireEvent.change(screen.getByLabelText(`Exception quantity for ${line.sku}`), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(`Exception reason for ${line.sku}`), { target: { value: "QC hold after GRN" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));

    expect(await screen.findByText(`${line.sku} exception recorded through governed 3PGS authority.`)).toBeTruthy();
    expect(await screen.findByText(/3PGS exception recorded, but refresh failed: parent refresh unavailable/)).toBeTruthy();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(`Exception quantity for ${line.sku}`)).toHaveValue(null);
    expect(screen.getByLabelText(`Exception reason for ${line.sku}`)).toHaveValue("");
  });

  it("fails locally when quantity exceeds the selected canonical bucket and never calls the RPC", async () => {
    render(<ThreePgsInventoryExceptionPanel receiptId="receipt-1" destinationStoreCode="3PGS" grnFinalisedAt="2026-09-01T00:00:00Z" reloadParent={vi.fn(async () => undefined)} />);
    await screen.findByText("Available 12");
    fireEvent.change(screen.getByLabelText(`Exception action for ${line.sku}`), { target: { value: "release_quarantine" } });
    expect(screen.getByLabelText(`Source bucket for ${line.sku}`)).toHaveValue("quarantine");
    fireEvent.change(screen.getByLabelText(`Exception quantity for ${line.sku}`), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(`Exception reason for ${line.sku}`), { target: { value: "QC cleared" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText("Quantity exceeds the quarantine balance.")).toBeTruthy();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
