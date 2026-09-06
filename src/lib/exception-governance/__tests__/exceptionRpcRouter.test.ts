import { describe, expect, it } from "vitest";
import { buildDeclarationRpc, buildReleaseRpc, idempotencyKeyFor } from "../exceptionRpcRouter";
import { ExceptionGovernanceError } from "../exceptionGovernanceTypes";

const ctx = {
  correlationId: "corr-abc",
  actorUserId: "user-1",
  actorRole: "HOD_ARABIC",
  actorDepartment: "ARABIC_SWEETS",
  reason: "QC hold pending inspection",
  evidenceRef: "photo-123",
};

describe("exceptionRpcRouter", () => {
  it("routes shortage to create_production_shortage_demand", () => {
    const call = buildDeclarationRpc(
      {
        category: "shortage",
        binding: { subsystem: "RGS", reservationId: "res-1", department: "ARABIC_SWEETS" },
      },
      ctx,
    );
    expect(call.rpcName).toBe("create_production_shortage_demand");
    expect(call.args).toMatchObject({
      p_reservation_id: "res-1",
      p_department: "ARABIC_SWEETS",
      p_correlation_id: "corr-abc",
    });
  });

  it("routes production wastage to record_production_output", () => {
    const call = buildDeclarationRpc(
      {
        category: "wastage",
        binding: { subsystem: "PRODUCTION", jobId: "job-1", batchNumber: "B-1" },
        quantities: { actualQty: 90, wastedQty: 10 },
      },
      ctx,
    );
    expect(call.rpcName).toBe("record_production_output");
    expect(call.args.p_wasted_qty).toBe(10);
    expect(call.args.p_job_id).toBe("job-1");
  });

  it("routes 3PGS quality hold to quarantine RPC", () => {
    const call = buildDeclarationRpc(
      {
        category: "quality_hold",
        binding: { subsystem: "3PGS", productId: "p1", sku: "PKG-1" },
        quantities: { holdQty: 5 },
      },
      ctx,
    );
    expect(call.rpcName).toBe("record_b2b_3pgs_inventory_exception");
    expect(call.args.p_action).toBe("quarantine");
    expect(call.args.p_quantity).toBe(5);
  });

  it("routes blocker release to resolve_production_issue", () => {
    const call = buildReleaseRpc(
      {
        category: "blocker",
        binding: { subsystem: "PRODUCTION", jobId: "job-1", department: "ARABIC_SWEETS" },
        targetId: "issue-1",
        resolutionNotes: "Mixer repaired",
      },
      { ...ctx, releaseAuthorizerRole: "ADMIN", reason: "resolved" },
    );
    expect(call.rpcName).toBe("resolve_production_issue");
    expect(call.args.p_issue_id).toBe("issue-1");
  });

  it("fails closed when no governed RPC exists", () => {
    expect(() =>
      buildDeclarationRpc(
        { category: "wastage", binding: { subsystem: "DISPATCH" } },
        ctx,
      ),
    ).toThrow(ExceptionGovernanceError);
  });

  it("builds deterministic idempotency keys", () => {
    const key = idempotencyKeyFor("shortage", "corr-1", "RGS:res-1");
    expect(key).toBe("point89:shortage:RGS:res-1:corr-1");
  });
});
