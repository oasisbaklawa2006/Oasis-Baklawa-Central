import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AssemblyManagement from "../AssemblyManagement";

const job = {
  id: "job-1",
  assembly_job_number: "PNA-000001",
  order_id: "order-1",
  output_product_id: "prod-out",
  output_sku: "HAMPER-1",
  planned_qty: 10,
  completed_qty: 0,
  accepted_qty: 0,
  rejected_qty: 0,
  status: "issued",
  correlation_id: "job-1-corr",
  started_at: null,
  completed_at: null,
  handed_over_at: null,
  job_completed_at: null,
  job_closed_at: null,
  partial_issue_authorized: false,
  reconciliation_variance_qty: null,
  output_level: "1B",
  job_purpose: null,
  bom_version: "v1",
  master_data_version: "v1",
  created_at: "2026-08-22T00:00:00.000Z",
};

const shortComponent = {
  id: "comp-1",
  assembly_job_id: "job-1",
  product_id: "prod-comp",
  sku: "RIBBON-1",
  source_store_code: "3PGS",
  required_qty: 10,
  reserved_qty: 4,
  issued_qty: 0,
  consumed_qty: 0,
  wasted_qty: 0,
  returned_qty: 0,
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

let componentsResult: unknown[] = [shortComponent];
let requirementsResult: unknown[] = [];

function makeChain(result: { data: unknown; error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  for (const method of ["select", "eq", "in", "order", "limit", "range"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: typeof result) => void) => resolve(result);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "b2b_assembly_jobs") return makeChain({ data: [job], error: null });
      if (relation === "b2b_assembly_components") return makeChain({ data: componentsResult, error: null });
      if (relation === "products") return makeChain({ data: [], error: null });
      if (relation === "b2b_assembly_handovers") return makeChain({ data: [], error: null });
      if (relation === "b2b_assembly_3pgs_requirements") return makeChain({ data: requirementsResult, error: null });
      return makeChain({ data: [], error: null });
    },
  },
}));

vi.mock("@/lib/pnaAssemblyRpc", () => ({
  pnaAssemblyRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  componentsResult = [shortComponent];
  requirementsResult = [];
});

describe("AssemblyManagement 3PGS requirement handoff", () => {
  it("offers to raise a 3PGS requirement for a short outsourced component", async () => {
    render(<AssemblyManagement />);
    expect(await screen.findByText("Raise 3PGS requirement")).toBeTruthy();
  });

  it("does not offer to raise a requirement when the component is fully reserved", async () => {
    componentsResult = [{ ...shortComponent, reserved_qty: 10 }];
    render(<AssemblyManagement />);
    await screen.findByText("Component reconciliation (Level 0 inputs)");
    expect(screen.queryByText("Raise 3PGS requirement")).toBeNull();
  });

  it("does not offer to raise a requirement when one is already open for the component", async () => {
    requirementsResult = [
      { id: "req-1", assembly_component_id: "comp-1", product_id: "prod-comp", sku: "RIBBON-1", source_store_code: "3PGS", requested_qty: 6, fulfilled_qty: 0, status: "open" },
    ];
    render(<AssemblyManagement />);
    expect(await screen.findByText("3PGS requirement raised")).toBeTruthy();
    expect(screen.queryByText("Raise 3PGS requirement")).toBeNull();
  });

  it("calls create_assembly_3pgs_requirement with the component's shortfall qty, reusing the same correlation id on retry", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<AssemblyManagement />);
    const button = await screen.findByText("Raise 3PGS requirement");

    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [firstFn, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(firstFn).toBe("create_assembly_3pgs_requirement");
    expect(firstArgs).toMatchObject({ p_assembly_component_id: "comp-1", p_requested_qty: 6, p_priority: "normal" });
    expect(secondArgs.p_correlation_id).toBe(firstArgs.p_correlation_id);
  });

  it("rotates the correlation id when the shortfall quantity has changed since the last failed attempt", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } });
    render(<AssemblyManagement />);
    const firstButton = await screen.findByText("Raise 3PGS requirement");
    fireEvent.click(firstButton);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    // Reservation progressed between attempts, so the real shortfall shrank --
    // a manual refresh (the screen's own "Refresh" action) picks that up.
    // The eventual retry must not replay the stale quantity under the old
    // correlation id.
    componentsResult = [{ ...shortComponent, reserved_qty: 6 }];
    fireEvent.click(screen.getByText("Refresh"));
    const secondButton = await screen.findByText("Raise 3PGS requirement");
    fireEvent.click(secondButton);
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));

    const [, firstArgs] = rpcMock.mock.calls[0];
    const [, secondArgs] = rpcMock.mock.calls[1];
    expect(firstArgs.p_requested_qty).toBe(6);
    expect(secondArgs.p_requested_qty).toBe(4);
    expect(secondArgs.p_correlation_id).not.toBe(firstArgs.p_correlation_id);
  });
});
