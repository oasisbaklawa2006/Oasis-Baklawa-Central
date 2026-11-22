import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  historyQueries: [] as Array<{ job: string; before: number | null; limit: number }>,
  denyHistory: false,
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      let jobFilter = "";
      let gateFilter = "";
      let historyBefore: number | null = null;
      const builder = {
        select: () => builder,
        eq: (field: string, value: string | boolean) => {
          if (field === "assembly_job_id") jobFilter = String(value);
          if (field === "gate") gateFilter = String(value);
          return builder;
        },
        lt: (field: string, value: number) => {
          if (field === "event_seq") historyBefore = value;
          return builder;
        },
        order: () => builder,
        limit: async (limit: number) => {
          if (gateFilter) qcMock.queries.push({ job: jobFilter, gate: gateFilter, limit });
          else qcMock.historyQueries.push({ job: jobFilter, before: historyBefore, limit });
          if (!gateFilter && qcMock.denyHistory) {
            return { data: null, error: { message: "Permission denied reading QC history" } };
          }
          return {
            data: qcMock.events
              .filter((event) => event.assembly_job_id === jobFilter
                && (!gateFilter || event.gate === gateFilter)
                && (historyBefore === null || event.event_seq < historyBefore))
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
  qcMock.historyQueries = [];
  qcMock.denyHistory = false;
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
    await waitFor(() => expect(within(screen.getByTestId("assembly-qc-latest-gates")).getAllByText("PASS")).toHaveLength(4));
    expect(qcMock.queries).toEqual([
      { job: "job-1", gate: "INPUT_MATERIAL", limit: 1 },
      { job: "job-1", gate: "FIRST_PIECE", limit: 1 },
      { job: "job-1", gate: "IN_PROCESS", limit: 1 },
      { job: "job-1", gate: "FINAL", limit: 1 },
    ]);
    expect(qcMock.historyQueries).toEqual([{ job: "job-1", before: null, limit: 51 }]);
    expect(screen.getByText("50 events loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh QC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("retains old failed inspections, reasons and inspectors beyond 250 newer events", async () => {
    qcMock.available = true;
    qcMock.events = [
      { ...event("INPUT_MATERIAL", 1), decision: "FAIL", reason: "Damaged wrapper", inspected_by: "inspector-older" },
      event("INPUT_MATERIAL", 2),
      event("FIRST_PIECE", 3),
      event("FINAL", 4),
      ...Array.from({ length: 251 }, (_, index) => event("IN_PROCESS", index + 5)),
    ];

    render(<AssemblyQcPanel jobId="job-1" jobStatus="qc_pending" />);
    await waitFor(() =>
      expect(within(screen.getByTestId("assembly-qc-latest-gates")).getAllByText("PASS")).toHaveLength(4),
    );
    expect(screen.queryByText("QC event #1")).not.toBeInTheDocument();
    for (let page = 2; page <= 6; page++) {
      fireEvent.click(screen.getByRole("button", { name: "Load older QC events" }));
      const count = Math.min(page * 50, 255);
      await waitFor(() => expect(screen.getByText(`${count} events loaded`)).toBeInTheDocument());
    }
    expect(screen.getByText("QC event #1")).toBeInTheDocument();
    const oldFail = screen.getByText("QC event #1").closest("li");
    expect(oldFail).not.toBeNull();
    expect(within(oldFail!).getByText("FAIL")).toBeInTheDocument();
    expect(within(oldFail!).getByText("Reason / notes: Damaged wrapper")).toBeInTheDocument();
    expect(within(oldFail!).getByText(/Inspector: inspector-older/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older QC events" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("assembly-qc-latest-gates")).getAllByText("PASS")).toHaveLength(4);
    expect(qcMock.historyQueries.map((query) => query.before)).toEqual([null, 206, 156, 106, 56, 6]);
    expect(qcMock.historyQueries.every((query) => query.limit === 51 && query.job === "job-1")).toBe(true);
  });

  it("fails closed when the Core history read is denied, even if latest gates are returned", async () => {
    qcMock.available = true;
    qcMock.events = [event("INPUT_MATERIAL", 1), event("FIRST_PIECE", 2)];
    qcMock.denyHistory = true;
    render(<AssemblyQcPanel jobId="job-1" jobStatus="in_progress" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("QC data unavailable"));
    expect(screen.getByRole("alert")).toHaveTextContent("Permission denied reading QC history");
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not evidenced")).toHaveLength(4);
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
