import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, isCoreRpcAvailableMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  isCoreRpcAvailableMock: vi.fn(),
}));

vi.mock("../partialFulfilmentQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../partialFulfilmentQueries")>();
  return {
    ...actual,
    isCoreRpcAvailable: isCoreRpcAvailableMock,
    partialFulfilmentRpc: rpcMock,
  };
});

import {
  approveRemainderDisposition,
  createGovernedDispatchSplitConsignment,
  recordProductionPartialFulfilment,
} from "../partialFulfilmentAuthorityClient";

describe("partialFulfilmentAuthorityClient (Point 76)", () => {
  beforeEach(() => {
    isCoreRpcAvailableMock.mockReset();
    rpcMock.mockReset();
  });

  it("fails closed when production partial fulfilment RPC is absent", async () => {
    isCoreRpcAvailableMock.mockResolvedValue(false);

    const result = await recordProductionPartialFulfilment({
      orderId: "order-1",
      orderItemId: "line-1",
      fulfilledQty: 4,
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      reason: "ready goods allocation",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers?.[0]?.code).toBe("CORE_AUTHORITY_ABSENT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls create_b2b_dispatch_consignment when dispatch split authority exists", async () => {
    isCoreRpcAvailableMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({ data: [{ consignment_id: "cons-1" }], error: null });

    const result = await createGovernedDispatchSplitConsignment({
      orderId: "order-1",
      correlationId: "corr-2",
      fragmentationOrigin: "customer_request",
      fragmentationReason: "partial shipment",
      destinationSnapshot: { city: "Mumbai" },
      dispatchMode: "road",
      sequenceNumber: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.consignmentId).toBe("cons-1");
    expect(rpcMock).toHaveBeenCalledWith("create_b2b_dispatch_consignment", expect.objectContaining({
      p_order_id: "order-1",
      p_sequence_number: 2,
    }));
  });

  it("fails closed when remainder closure RPC is absent", async () => {
    isCoreRpcAvailableMock.mockResolvedValue(false);

    const result = await approveRemainderDisposition({
      orderItemId: "line-1",
      approvedClosedQty: 3,
      reason: "customer approved balance write-off",
      customerEvidenceRef: "wa-msg-1",
      financeAdjustmentRef: "adj-1",
      correlationId: "corr-3",
      idempotencyKey: "idem-3",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers?.[0]?.scope).toBe("remainder_closure");
  });

  it("surfaces Core blockers from production partial fulfilment RPC", async () => {
    isCoreRpcAvailableMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({
      data: {
        ok: false,
        blockers: [{ code: "QTY_OVERFLOW", message: "fulfilled exceeds ordered", scope: "production_split" }],
      },
      error: null,
    });

    const result = await recordProductionPartialFulfilment({
      orderId: "order-1",
      orderItemId: "line-1",
      fulfilledQty: 99,
      correlationId: "corr-4",
      idempotencyKey: "idem-4",
      reason: "overflow attempt",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers?.[0]?.code).toBe("QTY_OVERFLOW");
  });
});
