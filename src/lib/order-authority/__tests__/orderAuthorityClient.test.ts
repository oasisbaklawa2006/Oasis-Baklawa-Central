import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import {
  clearOrderForDispatch,
  releaseCartonAtDispatchGate,
  releaseOrderToManufacturing,
  releaseOrderToPackedReady,
  rejectOrderFinanceReview,
  confirmPrepaidOrderAwaitingAdvance,
  recordOrderFullyPaid,
} from "../orderAuthorityClient";

describe("orderAuthorityClient", () => {
  beforeEach(() => {
    rpcMock.mockReset();
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

  it("surfaces server blockers from manufacturing release", async () => {
    rpcMock.mockResolvedValue({
      data: {
        ok: false,
        blockers: [{ code: "payment_not_cleared", message: "Payment must be verified" }],
      },
      error: null,
    });

    await expect(
      releaseOrderToManufacturing("o1", "awaiting_receipt", 0, 1000),
    ).rejects.toThrow("Payment must be verified");
    expect(rpcMock).toHaveBeenCalledWith("release_order_to_manufacturing_v1", {
      p_order_id: "o1",
      p_payment_status: "awaiting_receipt",
      p_advance_paid: 0,
      p_sales_order_value: 1000,
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
