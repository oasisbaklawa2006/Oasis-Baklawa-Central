import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartialFulfilmentPanel } from "../PartialFulfilmentPanel";

vi.mock("@/lib/order-partial-fulfilment/partialFulfilmentQueries", () => ({
  loadPartialFulfilmentFacts: vi.fn().mockResolvedValue({
    orderId: "order-1",
    authorityState: "dispatch_line_facts_available",
    lines: [
      {
        orderItemId: "line-1",
        productId: "prod-1",
        orderedQty: 10,
        confirmedQty: 10,
        cancelledQty: 0,
        fulfilledQty: 4,
        packedQty: 4,
        dispatchedQty: 2,
        deliveredQty: 0,
        approvedClosedQty: 0,
        remainderQty: 6,
        remainderDisposition: "open",
        openConsignmentCount: 0,
        quantityConserved: true,
        conservationViolations: [],
      },
    ],
    hasPartialFulfilment: true,
    hasOpenRemainder: true,
    hasSplitConsignments: false,
    quantityConserved: true,
    conservationViolations: [],
    replayKey: "rk-1",
    evaluatedAt: "2026-09-07T00:00:00.000Z",
  }),
}));

describe("PartialFulfilmentPanel", () => {
  it("renders Point 76 projection summary", async () => {
    render(<PartialFulfilmentPanel orderId="order-1" />);
    expect(await screen.findByText(/Partial \/ split fulfilment/i)).toBeTruthy();
    expect(await screen.findByText(/Remainder: 6/)).toBeTruthy();
  });
});
