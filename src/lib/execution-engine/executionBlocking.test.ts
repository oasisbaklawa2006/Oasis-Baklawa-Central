import { describe, expect, it } from "vitest";
import { DEFAULT_DISPATCH_GRAPH } from "./executionDependencies";
import { evaluateLaneStates, isDispatchLaneBlocked } from "./executionBlocking";

describe("executionBlocking", () => {
  it("blocks downstream lanes when finance is unsatisfied", () => {
    const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, {
      financeVerified: false,
      productionReady: true,
      packingComplete: true,
      barcodeReady: true,
      dispatchLabelReady: true,
    });
    expect(states.find((s) => s.lane === "finance")?.state).toMatch(/pending|blocked/);
    expect(states.find((s) => s.lane === "production")?.blockedBy).toEqual(["finance"]);
    expect(isDispatchLaneBlocked(states)).toBe(true);
  });

  it("clears dispatch lane when full satisfaction", () => {
    const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, {
      financeVerified: true,
      productionReady: true,
      packingComplete: true,
      barcodeReady: true,
      dispatchLabelReady: true,
    });
    expect(states.every((s) => s.state === "ready")).toBe(true);
    expect(isDispatchLaneBlocked(states)).toBe(false);
  });
});
