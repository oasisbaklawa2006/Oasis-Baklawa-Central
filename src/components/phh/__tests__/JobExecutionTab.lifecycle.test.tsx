import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobExecutionTab from "../JobExecutionTab";
import type { ProductionJob } from "../types";

// Regression / certification coverage for the production_jobs lifecycle RPC
// call sites in JobExecutionTab.tsx that had zero existing test coverage:
// start_production_job, pause_production_job, resume_production_job,
// advance_production_job_stage, and the three-step completion chain
// (record_production_output -> declare_production_ready ->
// dispatch_production_to_rgs). report_production_issue and
// resolve_production_issue are already covered by JobExecutionTab.test.tsx.

const baseJob: ProductionJob = {
  id: "job-1",
  order_item_id: null,
  order_id: "order-1",
  product_id: "prod-1",
  department: "ARABIC_SWEETS",
  assigned_to: null,
  assigned_qty: 10,
  produced_qty: 0,
  wasted_qty: 0,
  net_weight_per_unit: 0,
  batch_number: "B-1",
  priority: "normal",
  stage: "prep",
  status: "accepted",
  rejection_reason: null,
  started_at: null,
  completed_at: null,
  locked: false,
  created_at: null,
  updated_at: null,
  product: { name: "Test Sweet", image_url: null, sku: "SKU-1" },
};

const rpcMock = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({
  data: null,
  error: null as { message: string } | null,
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: (...args: unknown[]) => rpcMock(...(args as [string, Record<string, unknown>])) },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.then = (resolve: (value: { data: unknown[] }) => void) => resolve({ data: [] });
      return builder;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderJob(job: ProductionJob, onRefresh = vi.fn()) {
  render(<JobExecutionTab jobs={[job]} userId="user-1" department="ARABIC_SWEETS" onRefresh={onRefresh} />);
  fireEvent.click(screen.getByText("Test Sweet"));
  return { onRefresh };
}

describe("JobExecutionTab start / pause / resume", () => {
  it("calls start_production_job with the job id and a correlation id for an accepted job", async () => {
    const { onRefresh } = renderJob({ ...baseJob, status: "accepted" });
    fireEvent.click(screen.getByText("Start Production"));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("start_production_job", {
        p_job_id: "job-1",
        p_correlation_id: expect.any(String),
      }),
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("does not allow a second Start click to fire an overlapping RPC (idempotency guard)", async () => {
    let resolveRpc: (value: { data: null; error: null }) => void = () => {};
    rpcMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRpc = resolve; }));
    renderJob({ ...baseJob, status: "accepted" });
    const startButton = screen.getByText("Start Production");
    fireEvent.click(startButton);
    // Button is disabled while the first call is in flight -- a second
    // click should not register.
    fireEvent.click(startButton);

    resolveRpc({ data: null, error: null });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));
  });

  it("opens the pause modal and calls pause_production_job with reason and comment", async () => {
    renderJob({ ...baseJob, status: "in_production" });
    fireEvent.click(screen.getByText("Pause Production"));
    fireEvent.click(screen.getByText("📦 Material Shortage"));
    fireEvent.change(screen.getByPlaceholderText("Additional notes..."), { target: { value: "Out of sugar" } });
    fireEvent.click(screen.getByText("Confirm Pause"));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("pause_production_job", {
        p_job_id: "job-1",
        p_reason: "material_shortage",
        p_comment: "Out of sugar",
        p_correlation_id: expect.any(String),
      }),
    );
  });

  it("blocks Confirm Pause until a reason is selected", () => {
    renderJob({ ...baseJob, status: "in_production" });
    fireEvent.click(screen.getByText("Pause Production"));
    expect(screen.getByText("Confirm Pause")).toBeDisabled();
  });

  it("calls resume_production_job with the job id and a correlation id for a paused job", async () => {
    const { onRefresh } = renderJob({ ...baseJob, status: "paused" });
    fireEvent.click(screen.getByText("Resume Production"));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("resume_production_job", {
        p_job_id: "job-1",
        p_correlation_id: expect.any(String),
      }),
    );
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("surfaces a start_production_job RPC error via toast", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Job already started" } });
    const { toast } = await import("sonner");
    renderJob({ ...baseJob, status: "accepted" });
    fireEvent.click(screen.getByText("Start Production"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Job already started"));
  });
});

describe("JobExecutionTab stage advance", () => {
  it("calls advance_production_job_stage for an in-production job", async () => {
    renderJob({ ...baseJob, status: "in_production", stage: "prep" });
    fireEvent.click(screen.getByText(/Advance to/));

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("advance_production_job_stage", {
        p_job_id: "job-1",
        p_correlation_id: expect.any(String),
      }),
    );
  });
});

describe("JobExecutionTab completion chain (record_output -> declare_ready -> dispatch_to_rgs)", () => {
  function fillAndComplete(producedQty: string) {
    // Both Produced Qty and Wasted Qty share placeholder="0" -- the
    // Produced field renders first in document order.
    fireEvent.change(screen.getAllByPlaceholderText("0")[0], { target: { value: producedQty } });
    fireEvent.click(screen.getByText("Production Completed → Transfer to RGS"));
  }

  it("blocks completion when no produced quantity is entered", () => {
    renderJob({ ...baseJob, status: "in_production" });
    fireEvent.click(screen.getByText("Production Completed → Transfer to RGS"));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls all three RPCs in order with matching job id and produced/dispatched qty", async () => {
    renderJob({ ...baseJob, status: "in_production", assigned_qty: 6 });
    fillAndComplete("6");

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "record_production_output",
        expect.objectContaining({ p_job_id: "job-1", p_produced_qty: 6, p_wasted_qty: 0, p_batch_number: "B-1" }),
      ),
    );
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("declare_production_ready", {
        p_job_id: "job-1",
        p_correlation_id: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith("dispatch_production_to_rgs", {
        p_job_id: "job-1",
        p_dispatched_qty: 6,
        p_correlation_id: expect.any(String),
      }),
    );

    const order = rpcMock.mock.calls.map((c) => c[0]);
    expect(order.indexOf("record_production_output")).toBeLessThan(order.indexOf("declare_production_ready"));
    expect(order.indexOf("declare_production_ready")).toBeLessThan(order.indexOf("dispatch_production_to_rgs"));
  });

  it("stops the chain and surfaces the error if record_production_output fails, without calling declare_production_ready", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "Output rejected" } });
    const { toast } = await import("sonner");
    renderJob({ ...baseJob, status: "in_production", assigned_qty: 6 });
    fillAndComplete("6");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Output rejected"));
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a produced+wasted total exceeding assigned qty by more than 10% before calling any RPC", async () => {
    const { toast } = await import("sonner");
    renderJob({ ...baseJob, status: "in_production", assigned_qty: 10 });
    fireEvent.change(screen.getAllByPlaceholderText("0")[0], { target: { value: "12" } });
    fireEvent.click(screen.getByText("Production Completed → Transfer to RGS"));

    expect(rpcMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("exceeds assigned qty"));
  });
});
