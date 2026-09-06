import { describe, expect, it } from "vitest";
import { projectPartialFulfilmentOrder } from "../partialFulfilmentProjection";
import { projectCustomerPartialFulfilment } from "../customerPartialFulfilmentProjection";
import type { PartialFulfilmentLineInput } from "../partialFulfilmentTypes";

describe("customerPartialFulfilmentProjection (Point 76)", () => {
  it("never marks whole order dispatched when a split remainder is open", () => {
    const projection = projectPartialFulfilmentOrder({
      orderId: "order-1",
      lines: [
        {
          orderItemId: "line-1",
          productId: "prod-1",
          orderedQty: 10,
          packedQty: 10,
          productionStatus: "completed",
          dispatchLine: {
            orderItemId: "line-1",
            productId: "prod-1",
            originalOrderQty: 10,
            cumulativeDispatchedQty: 4,
            residualQty: 6,
            approvedClosedQty: 0,
          },
          reservations: [],
          residualClosures: [],
          consignmentSplits: [],
        } satisfies PartialFulfilmentLineInput,
      ],
    });

    const customer = projectCustomerPartialFulfilment(projection);

    expect(customer.headlineStatus).toBe("PARTIALLY_DISPATCHED");
    expect(customer.headlineLabel).toContain("Part of your order");
    expect(customer.suppressesWholeOrderDispatched).toBe(true);
    expect(customer.suppressesWholeOrderDelivered).toBe(true);
  });

  it("exposes per-line pending balance without internal split terminology", () => {
    const projection = projectPartialFulfilmentOrder({
      orderId: "order-2",
      lines: [
        {
          orderItemId: "line-2",
          productId: "prod-2",
          orderedQty: 20,
          packedQty: 8,
          productionStatus: "partial_ready",
          dispatchLine: null,
          reservations: [],
          residualClosures: [],
          consignmentSplits: [],
        },
      ],
    });

    const customer = projectCustomerPartialFulfilment(projection);

    expect(customer.lines[0].pendingBalanceQty).toBe(20);
    expect(customer.lines[0].customerLabel).not.toMatch(/child|split so|remainder/i);
    expect(customer.headlineStatus).toBe("PARTIALLY_READY");
  });
});
