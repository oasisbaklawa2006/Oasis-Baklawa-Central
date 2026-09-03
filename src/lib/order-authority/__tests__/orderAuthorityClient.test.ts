import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  rpcMock,
  getUserMock,
  resolvePaymentBindingMock,
  getFinanceOperationsClearanceFactsMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getUserMock: vi.fn(),
  resolvePaymentBindingMock: vi.fn(),
  getFinanceOperationsClearanceFactsMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
    auth: {
      getUser: getUserMock,
    },
  },
}));

vi.mock("@/lib/order-authority/paymentAuthorityClient", () => ({
  resolvePaymentBinding: resolvePaymentBindingMock,
}));

vi.mock("@/lib/order-authority/financeClearanceAuthorityClient", () => ({
  getFinanceOperationsClearanceFacts: getFinanceOperationsClearanceFactsMock,
  decideFinanceOperationsClearance: vi.fn(),
  buildFinanceOperationsDecisionIdentity: vi.fn(() => "identity"),
  buildFinanceOperationsCorrelationId: vi.fn(async () => "correlation"),
  buildFinanceOperationsIdempotencyKey: vi.fn(async () => "idempotency"),
}));

import {
  clearOrderForDispatch,
  releaseCartonAtDispatchGate,
  releaseOrderToDispatched,
  releaseOrderToInProduction,
  releaseOrderToManufacturing,
  releaseOrderToPackedReady,
  rejectOrderFinanceReview,
  confirmPrepaidOrderAwaitingAdvance,
  recordOrderFullyPaid,
} from "../orderAuthorityClient";

describe("orderAuthorityClient", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getUserMock.mockReset();
    resolvePaymentBindingMock.mockReset();
    getFinanceOperationsClearanceFactsMock.mockReset();

    getUserMock.mockResolvedValue({ data: { user: { id: "finance-actor-1" } }, error: null });
    resolvePaymentBindingMock.mockResolvedValue({
      piId: "pi-1",
      commercialVersionId: "version-1",
    });
    getFinanceOperationsClearanceFactsMock.mockResolvedValue({
      orderId: "o1",
      companyId: "company-1",
      piId: "pi-1",
      commercialVersionId: "version-1",
      commercialValue: 1000,
      requiredAdvance: 500,
      verifiedPaymentAmount: 500,
      walletAppliedAmount: 0,
      approvedCreditAmount: 0,
      coveredAmount: 500,
      eligibleForOperationsClearance: true,
      latestClearanceEventId: "clearance-1",
      latestClearanceDecision: "GRANTED",
    });
  });

  it("calls clear_order_for_dispatch_v1 RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, order_id: "o1", new_status: "cleared_for_dispatch" },
      error: null,
    });

    const result = await clearOrderForDispatch("o1");
    expect(rpcMock).toHaveBeenCalledWith("clear_order_for_dispatch_v1", { p_order_id: "o1" });
    expect(result.ok).toBe(true);
  });

  it("calls release_order_to_dispatched_v1 RPC (Point 38)", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "o1",
        previous_status: "cleared_for_dispatch",
        new_status: "dispatched",
      },
      error: null,
    });

    const result = await releaseOrderToDispatched("o1", {
      trackingNumber: "LR-POINT38",
      courierName: "BlueDart",
      finalizeReason: "Governed finalize",
      correlationId: "corr-point38",
    });
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_dispatched_v1", {
      p_order_id: "o1",
      p_tracking_number: "LR-POINT38",
      p_courier_name: "BlueDart",
      p_finalize_reason: "Governed finalize",
      p_correlation_id: "corr-point38",
    });
    expect(result.ok).toBe(true);
    expect(result.new_status).toBe("dispatched");
  });

  it("calls release_order_to_in_production_v1 after Finance Operations Clearance (Point 37)", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: true,
        order_id: "o1",
        previous_status: "confirmed",
        new_status: "in_production",
      },
      error: null,
    });

    const result = await releaseOrderToInProduction("o1", "verified_advance");
    expect(result.ok).toBe(true);
    expect(result.new_status).toBe("in_production");
    expect(getFinanceOperationsClearanceFactsMock).toHaveBeenCalledWith("o1", "pi-1", "version-1");
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_in_production_v1", { p_order_id: "o1" });
    expect(rpcMock.mock.calls.map(([name]) => name)).not.toContain("release_order_to_manufacturing_v1");
  });

  it("surfaces server blockers from production release after Finance Operations Clearance", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: false,
        blockers: [{ code: "production_blocked", message: "Production release blocked" }],
      },
      error: null,
    });

    await expect(releaseOrderToInProduction("o1", "verified_advance")).rejects.toThrow("Production release blocked");
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_in_production_v1", { p_order_id: "o1" });
  });

  it("surfaces server blockers from manufacturing release after Finance Operations Clearance", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: false,
        blockers: [{ code: "manufacturing_blocked", message: "Manufacturing release blocked" }],
      },
      error: null,
    });

    await expect(
      releaseOrderToManufacturing("o1", "awaiting_receipt", 0, 1000),
    ).rejects.toThrow("Manufacturing release blocked");

    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(resolvePaymentBindingMock).toHaveBeenCalledWith("o1");
    expect(getFinanceOperationsClearanceFactsMock).toHaveBeenCalledWith("o1", "pi-1", "version-1");
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_manufacturing_v1", {
      p_order_id: "o1",
    });
  });

  it("calls packed_ready RPC instead of direct status mutation", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, order_id: "o1", new_status: "packed_ready" },
      error: null,
    });

    await releaseOrderToPackedReady("o1");
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_packed_ready_v1", { p_order_id: "o1" });
  });

  it("calls finance reject RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    await rejectOrderFinanceReview("o1", "blurry receipt");
    expect(rpcMock).toHaveBeenCalledWith("reject_order_finance_review_v1", {
      p_order_id: "o1",
      p_rejection_reason: "blurry receipt",
    });
  });

  it("calls prepaid confirm RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, status: "awaiting_advance" }, error: null });
    await confirmPrepaidOrderAwaitingAdvance("o1");
    expect(rpcMock).toHaveBeenCalledWith("confirm_prepaid_order_awaiting_advance_v1", { p_order_id: "o1" });
  });

  it("calls record fully paid RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, payment_status: "paid" }, error: null });
    await recordOrderFullyPaid("o1");
    expect(rpcMock).toHaveBeenCalledWith("record_order_fully_paid_v1", { p_order_id: "o1" });
  });

  it("calls gate release RPC with scan evidence id", async () => {
    rpcMock.mockResolvedValue({
      data: { ok: true, carton_status: "physically_dispatched" },
      error: null,
    });

    await releaseCartonAtDispatchGate("c1", "scan-1");
    expect(rpcMock).toHaveBeenCalledWith("release_carton_at_dispatch_gate_v1", {
      p_carton_id: "c1",
      p_scan_evidence_id: "scan-1",
    });
  });

  it("invokes rpc with the Supabase client as receiver", async () => {
    rpcMock.mockImplementation(function (
      this: { rpc: typeof rpcMock },
      fn: string,
      args?: Record<string, unknown>,
    ) {
      expect(this).toBeDefined();
      expect(this.rpc).toBe(rpcMock);
      return Promise.resolve({
        data: { ok: true, order_id: "o1", new_status: "cleared_for_dispatch" },
        error: null,
      });
    });

    await clearOrderForDispatch("o1");
    expect(rpcMock).toHaveBeenCalledWith("clear_order_for_dispatch_v1", { p_order_id: "o1" });
  });

  it("documents that detached rpc breaks receiver-dependent clients", async () => {
    const client = {
      rest: {
        rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
      },
      rpc(fn: string, args?: Record<string, unknown>) {
        return this.rest.rpc(fn, args);
      },
    };
    const detached = client.rpc;
    expect(() => detached("release_order_to_packed_ready_v1", { p_order_id: "o1" })).toThrow();
    await expect(
      client.rpc.call(client, "release_order_to_packed_ready_v1", { p_order_id: "o1" }),
    ).resolves.toEqual({ data: { ok: true }, error: null });
  });
});
