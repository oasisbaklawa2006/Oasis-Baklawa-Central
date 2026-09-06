import { describe, expect, it, vi } from "vitest";
import { createExceptionGovernanceService } from "../exceptionGovernanceService";
import { ExceptionGovernanceError } from "../exceptionGovernanceTypes";

const hodCtx = {
  correlationId: "corr-1",
  actorUserId: "user-1",
  actorRole: "HOD_ARABIC",
  actorDepartment: "ARABIC_SWEETS",
  reason: "Material jam on mixer",
};

function serviceWithRpc(mock = vi.fn().mockResolvedValue({ data: { id: "issue-1" }, error: null })) {
  return createExceptionGovernanceService({ rpc: { rpc: mock } });
}

describe("exceptionGovernanceService", () => {
  it("declares blocker through governed report_production_issue RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "issue-1" }, error: null });
    const svc = serviceWithRpc(rpc);
    const result = await svc.declare(
      {
        category: "blocker",
        binding: { subsystem: "PRODUCTION", jobId: "job-1", department: "ARABIC_SWEETS" },
        issueType: "equipment",
      },
      hodCtx,
    );
    expect(result.rpcName).toBe("report_production_issue");
    expect(rpc).toHaveBeenCalledWith(
      "report_production_issue",
      expect.objectContaining({ p_job_id: "job-1", p_correlation_id: "corr-1" }),
    );
    expect(svc.listOpen()).toHaveLength(1);
  });

  it("denies declaration without authority", async () => {
    const svc = serviceWithRpc();
    await expect(
      svc.declare(
        {
          category: "shortage",
          binding: { subsystem: "RGS", reservationId: "res-1", department: "ARABIC_SWEETS" },
        },
        { ...hodCtx, actorRole: "FINANCE_HEAD" },
      ),
    ).rejects.toThrow(ExceptionGovernanceError);
  });

  it("replays duplicate correlation idempotently", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "job-2" }, error: null });
    const svc = serviceWithRpc(rpc);
    const input = {
      category: "shortage" as const,
      binding: { subsystem: "RGS" as const, reservationId: "res-1", department: "ARABIC_SWEETS" },
    };
    await svc.declare(input, { ...hodCtx, actorRole: "INVENTORY_MANAGER", reason: "No stock" });
    const replay = await svc.declare(input, { ...hodCtx, actorRole: "INVENTORY_MANAGER", reason: "No stock" });
    expect(replay.alreadyApplied).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("releases quality hold only with independent authorizer", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { already_recorded: true }, error: null });
    const svc = serviceWithRpc(rpc);
    await expect(
      svc.release(
        {
          category: "quality_hold",
          binding: { subsystem: "3PGS", productId: "p1", sku: "SKU-1" },
          targetId: "qh-1",
          resolutionNotes: "QC passed",
          quantities: { holdQty: 3 },
        },
        {
          ...hodCtx,
          actorRole: "QUALITY_CONTROLLER",
          reason: "Released after inspection",
        },
      ),
    ).rejects.toThrow(ExceptionGovernanceError);

    const result = await svc.release(
      {
        category: "quality_hold",
        binding: { subsystem: "3PGS", productId: "p1", sku: "SKU-1" },
        targetId: "qh-1",
        resolutionNotes: "QC passed",
        quantities: { holdQty: 3 },
      },
      {
        ...hodCtx,
        actorRole: "QUALITY_CONTROLLER",
        reason: "Released after inspection",
        releaseAuthorizerRole: "ADMIN",
      },
    );
    expect(result.rpcName).toBe("record_b2b_3pgs_inventory_exception");
    expect(rpc).toHaveBeenCalledWith(
      "record_b2b_3pgs_inventory_exception",
      expect.objectContaining({ p_action: "release_quarantine" }),
    );
  });

  it("surfaces RPC errors fail-closed", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "RLS denied" } });
    const svc = serviceWithRpc(rpc);
    await expect(
      svc.declare(
        {
          category: "rejection",
          binding: { subsystem: "PRODUCTION", jobId: "job-9" },
        },
        hodCtx,
      ),
    ).rejects.toMatchObject({ code: "rpc_unavailable" });
  });
});
