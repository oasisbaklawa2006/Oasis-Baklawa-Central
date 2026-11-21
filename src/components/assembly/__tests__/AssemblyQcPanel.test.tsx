import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssemblyQcPanel, { canRecordAssemblyQcGate } from "../AssemblyQcPanel";

type MockQcEvent = {
  id: string;
  event_seq: number;
  assembly_job_id: string;
  gate: string;
  decision: string;
  sample_qty: number;
  evidence_reference: string;
  reason: string | null;
  inspected_by: string;
  created_at: string;
};

const qcMock = vi.hoisted(() => ({
  available: false,
  events: [] as MockQcEvent[],
  queries: [] as Array<{ job: string; gate: string; limit: number }>,
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      let jobFilter = "";
      let gateFilter = "";
      const builder = {
        select: () => builder,
        eq: (field: string, value: string | boolean) => {
          if (field === "assembly_job_id") jobFilter = String(value);
          if (field === "gate") gateFilter = String(value);
          return builder;
        },
        order: () => builder,
        limit: async (limit: number) => {
          qcMock.queries.push({ job: jobFilter, gate: gateFilter, limit });
          return {
            data: qcMock.events
              .filter((event) => event.assembly_job_id === jobFilter && event.gate === gateFilter)
              .sort((left, right) => right.event_seq - left.event_seq)
              .slice(0, limit),
            error: null,
          };
        },
        maybeSingle: async () => ({
          data: qcMock.available ? { enforced: false, policy_version: "F28-pilot" } : null,
          error: !qcMock.available && relation === "assembly_qc_commissioning_v1"
            ? { message: "permission denied for table assembly_qc_commissioning_v1" } : null,
        }),
      };
      return builder;
    },
  },
}));

vi.mock("@/lib/pnaAssemblyRpc", () => ({
  pnaAssemblyRpc: { rpc: (...args: unknown[]) => qcMock.rpc(...args) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function event(gate: string, sequence: number, jobId = "job-1"): MockQcEvent {
  return {
    id: `event-${gate}-${sequence}`,
    event_seq: sequence,
    assembly_job_id: jobId,
    gate,
    decision: "PASS",
    sample_qty: 2,
    evidence_reference: `protected-media:${sequence}`,
    reason: null,
    inspected_by: "staff-1",
    created_at: "2026-11-21T05:00:00.000Z",
  };
}

afterEach(() => {
  qcMock.available = false;
  qcMock.events = [];
  qcMock.queries = [];
  qcMock.rpc.mockReset();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Factory F28 governed QC gates", () => {
  it.each([
    ["materials_reserved", "INPUT_MATERIAL", true],
    ["partially_reserved", "INPUT_MATERIAL", true],
    ["planned", "INPUT_MATERIAL", false],
    ["in_progress", "FIRST_PIECE", true],
    ["in_progress", "IN_PROCESS", true],
    ["materials_reserved", "IN_PROCESS", false],
    ["qc_pending", "FINAL", true],
    ["in_progress", "FINAL", false],
    ["accepted", "FINAL", false],
  ] as const)("%s permits %s: %s", (status, stage, permitted) => {
    expect(canRecordAssemblyQcGate(status, stage)).toBe(permitted);
  });

  it("shows Core authority error, not synthetic PASS badges, when QC is unavailable", async () => {
    render(<AssemblyQcPanel jobId="job-1" jobStatus="in_progress" />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("QC data unavailable");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Do not assume approval");
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not evidenced")).toHaveLength(4);
  });

  it("loads the latest event of each stage even after more than 250 later inspections", async () => {
    qcMock.available = true;
    qcMock.events = [
      event("INPUT_MATERIAL", 1),
      event("FIRST_PIECE", 2),
      event("FINAL", 3),
      ...Array.from({ length: 251 }, (_, index) => event("IN_PROCESS", index + 4)),
    ];
    render(<AssemblyQcPanel jobId="job-1" jobStatus="qc_pending" />);
    await waitFor(() => expect(screen.getAllByText("PASS")).toHaveLength(4));
    expect(qcMock.queries).toEqual([
      { job: "job-1", gate: "INPUT_MATERIAL", limit: 1 },
      { job: "job-1", gate: "FIRST_PIECE", limit: 1 },
      { job: "job-1", gate: "IN_PROCESS", limit: 1 },
      { job: "job-1", gate: "FINAL", limit: 1 },
    ]);
    expect(screen.getByRole("button", { name: "Refresh QC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("preserves uncertain Core write correlation when the operator switches jobs and returns", async () => {
    qcMock.available = true;
    qcMock.rpc.mockResolvedValue({ data: null, error: { message: "Lost response after Core commit" } });
    const retries = new Map<string, string>();
    let serial = 0;
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      randomUUID: () => `qc-correlation-${++serial}`,
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
    });

    const first = render(
      <AssemblyQcPanel jobId="job-1" jobStatus="materials_reserved" retryCorrelations={retries} />,
    );
    await screen.findByRole("button", { name: "Refresh QC" });
    await waitFor(() => expect(screen.getByLabelText("Sampled quantity")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Sampled quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Evidence reference/), { target: { value: "protected:qc:42" } });
    fireEvent.click(screen.getByRole("button", { name: "Record with Core QC authority" }));
    await waitFor(() => expect(qcMock.rpc).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Record with Core QC authority" })).not.toBeDisabled());
    const firstCorrelation = qcMock.rpc.mock.calls[0][1].p_correlation_id;
    expect(retries.size).toBe(1);

    first.unmount();
    const second = render(
      <AssemblyQcPanel jobId="job-2" jobStatus="materials_reserved" retryCorrelations={retries} />,
    );
    await screen.findByRole("button", { name: "Refresh QC" });
    second.unmount();
    render(<AssemblyQcPanel jobId="job-1" jobStatus="materials_reserved" retryCorrelations={retries} />);
    await screen.findByRole("button", { name: "Refresh QC" });
    fireEvent.change(screen.getByLabelText("Sampled quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Evidence reference/), { target: { value: "protected:qc:42" } });
    fireEvent.click(screen.getByRole("button", { name: "Record with Core QC authority" }));
    await waitFor(() => expect(qcMock.rpc).toHaveBeenCalledTimes(2));
    expect(qcMock.rpc.mock.calls[1][1].p_correlation_id).toBe(firstCorrelation);
    expect(serial).toBe(1);

    await waitFor(() => expect(screen.getByRole("button", { name: "Record with Core QC authority" })).not.toBeDisabled());
    qcMock.rpc.mockResolvedValueOnce({ data: null, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Record with Core QC authority" }));
    await waitFor(() => expect(qcMock.rpc).toHaveBeenCalledTimes(3));
    expect(qcMock.rpc.mock.calls[2][1].p_correlation_id).toBe(firstCorrelation);
    await waitFor(() => expect(retries.size).toBe(0));
  });
});
