import { describe, expect, it } from "vitest";
import {
  assertPartialFulfilmentReplayStable,
  projectPartialFulfilmentLine,
  projectPartialFulfilmentOrder,
} from "../partialFulfilmentProjection";
import type { PartialFulfilmentLineInput } from "../partialFulfilmentTypes";

function baseLine(overrides: Partial<PartialFulfilmentLineInput> = {}): PartialFulfilmentLineInput {
  return {
    orderItemId: "line-1",
    productId: "prod-1",
    orderedQty: 10,
    packedQty: 0,
    productionStatus: "pending",
    dispatchLine: null,
    reservations: [],
    residualClosures: [],
    consignmentSplits: [],
    ...overrides,
  };
}

describe("partialFulfilmentProjection quantity conservation (Point 76)", () => {
  it("conserves dispatch authority facts: original = dispatched + residual", () => {
    const line = projectPartialFulfilmentLine(
      baseLine({
        packedQty: 6,
        dispatchLine: {
          orderItemId: "line-1",
          productId: "prod-1",
          originalOrderQty: 10,
          cumulativeDispatchedQty: 6,
          residualQty: 4,
          approvedClosedQty: 0,
        },
      }),
    );

    expect(line.quantityConserved).toBe(true);
    expect(line.dispatchedQty).toBe(6);
    expect(line.remainderQty).toBe(4);
    expect(line.conservationViolations).toEqual([]);
  });

  it("flags divergence when dispatch facts break conservation", () => {
    const line = projectPartialFulfilmentLine(
      baseLine({
        dispatchLine: {
          orderItemId: "line-1",
          productId: "prod-1",
          originalOrderQty: 10,
          cumulativeDispatchedQty: 7,
          residualQty: 4,
          approvedClosedQty: 0,
        },
      }),
    );

    expect(line.quantityConserved).toBe(false);
    expect(line.conservationViolations.some((v) => v.includes("conservation failed"))).toBe(true);
  });

  it("derives remainder without dispatch authority from fulfilled and closed buckets", () => {
    const line = projectPartialFulfilmentLine(
      baseLine({
        orderedQty: 12,
        packedQty: 5,
        reservations: [
          {
            reservationId: "res-1",
            requestedQty: 12,
            reservedQty: 5,
            fulfilledQty: 5,
            releasedQty: 0,
            reservationStatus: "partially_reserved",
          },
        ],
        residualClosures: [
          {
            closureId: "close-1",
            orderItemId: "line-1",
            approvedClosedQty: 2,
            reason: "customer approved balance cancellation",
            correlationId: "corr-1",
          },
        ],
      }),
    );

    expect(line.fulfilledQty).toBe(5);
    expect(line.approvedClosedQty).toBe(2);
    expect(line.remainderQty).toBe(5);
  });

  it("detects multi-split consignments and partial fulfilment at order level", () => {
    const projection = projectPartialFulfilmentOrder({
      orderId: "order-1",
      lines: [
        baseLine({
          dispatchLine: {
            orderItemId: "line-1",
            productId: "prod-1",
            originalOrderQty: 10,
            cumulativeDispatchedQty: 4,
            residualQty: 6,
            approvedClosedQty: 0,
          },
          consignmentSplits: [
            {
              consignmentId: "c-1",
              consignmentNumber: "CN-1",
              sequenceNumber: 1,
              status: "delivered",
              fragmentationOrigin: "customer_request",
              fragmentationReason: "split shipment",
              lineSelectedQty: 4,
            },
            {
              consignmentId: "c-2",
              consignmentNumber: "CN-2",
              sequenceNumber: 2,
              status: "open",
              fragmentationOrigin: "customer_request",
              fragmentationReason: "remainder",
              lineSelectedQty: 6,
            },
          ],
        }),
      ],
      evaluatedAt: "2026-09-06T00:00:00.000Z",
    });

    expect(projection.hasPartialFulfilment).toBe(true);
    expect(projection.hasOpenRemainder).toBe(true);
    expect(projection.hasSplitConsignments).toBe(true);
    expect(projection.authorityState).toBe("dispatch_line_facts_available");
  });

  it("replay is idempotent for identical facts", () => {
    const lines = [
      baseLine({
        dispatchLine: {
          orderItemId: "line-1",
          productId: "prod-1",
          originalOrderQty: 8,
          cumulativeDispatchedQty: 3,
          residualQty: 5,
          approvedClosedQty: 0,
        },
      }),
    ];

    const first = projectPartialFulfilmentOrder({ orderId: "order-1", lines, evaluatedAt: "t1" });
    const second = projectPartialFulfilmentOrder({ orderId: "order-1", lines, evaluatedAt: "t2" });

    expect(assertPartialFulfilmentReplayStable(first, second)).toBe(true);
    expect(first.replayKey).toBe(second.replayKey);
  });

  it("treats cancellation interaction as explicit closed remainder", () => {
    const line = projectPartialFulfilmentLine(
      baseLine({
        orderedQty: 10,
        cancelledQty: 10,
        dispatchLine: {
          orderItemId: "line-1",
          productId: "prod-1",
          originalOrderQty: 10,
          cumulativeDispatchedQty: 0,
          residualQty: 0,
          approvedClosedQty: 0,
        },
      }),
    );

    expect(line.remainderDisposition).toBe("cancelled");
    expect(line.remainderQty).toBe(0);
  });
});
