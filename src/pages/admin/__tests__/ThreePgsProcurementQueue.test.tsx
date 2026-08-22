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

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

let demandResult: unknown[] = [demandRow];
let procurementResult: unknown[] = [procurementRow];

function makeQuery(result: { data: unknown; error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve(result);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_3pgs_pending_demand_priority") return makeQuery({ data: demandResult, error: null });
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
