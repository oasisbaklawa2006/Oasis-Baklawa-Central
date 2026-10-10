import { afterEach, describe, expect, it, vi } from "vitest";
import { productionGovernedRpc } from "../productionGovernedRpc";

const rpcMock = vi.fn(async (_name: string, _args?: Record<string, unknown>) => ({ data: { ok: true }, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args?: Record<string, unknown>) => rpcMock(name, args ?? {}),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("productionGovernedRpc", () => {
  it("calls start_production_job with a correlation id", async () => {
    await productionGovernedRpc.startJob({ p_job_id: "job-1" }, {
      id: "job-1",
      status: "accepted",
      stage: "prep",
      assigned_qty: 5,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "start_production_job",
      expect.objectContaining({
        p_job_id: "job-1",
        p_correlation_id: expect.stringMatching(/^start-/),
      }),
    );
  });

  it("fail-closes start when job is not accepted", async () => {
    await expect(
      productionGovernedRpc.startJob({ p_job_id: "job-1" }, {
        id: "job-1",
        status: "pending",
        stage: "prep",
        assigned_qty: 5,
      }),
    ).rejects.toThrow(/Invalid production transition/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("fail-closes pause without reason before RPC", async () => {
    await expect(
      productionGovernedRpc.pauseJob({
        p_job_id: "job-1",
        p_reason: "",
      }, {
        id: "job-1",
        status: "in_production",
        stage: "prep",
        assigned_qty: 5,
      }),
    ).rejects.toThrow(/Pause reason is required/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("replays the same correlation id for idempotent retry", async () => {
    const correlationId = "start-fixed-id";
    await productionGovernedRpc.startJob({
      p_job_id: "job-1",
      p_correlation_id: correlationId,
    }, {
      id: "job-1",
      status: "accepted",
      stage: "prep",
      assigned_qty: 5,
    });
    await productionGovernedRpc.startJob({
      p_job_id: "job-1",
      p_correlation_id: correlationId,
    }, {
      id: "job-1",
      status: "accepted",
      stage: "prep",
      assigned_qty: 5,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(1, "start_production_job", expect.objectContaining({ p_correlation_id: correlationId }));
    expect(rpcMock).toHaveBeenNthCalledWith(2, "start_production_job", expect.objectContaining({ p_correlation_id: correlationId }));
  });

  it("blocks record_output when completion gate fails", async () => {
    const result = await productionGovernedRpc.recordOutput({
      p_job_id: "job-1",
      p_produced_qty: 0,
      p_wasted_qty: 0,
    }, {
      id: "job-1",
      status: "in_production",
      stage: "ready",
      assigned_qty: 10,
    });
    expect(result.error?.message).toMatch(/greater than zero/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("routes allocation through create_production_shortage_demand", async () => {
    await productionGovernedRpc.createShortageDemand({
      p_reservation_id: "res-1",
      p_department: "ARABIC_SWEETS",
      p_priority: "normal",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "create_production_shortage_demand",
      expect.objectContaining({
        p_reservation_id: "res-1",
        p_department: "ARABIC_SWEETS",
      }),
    );
  });
});
