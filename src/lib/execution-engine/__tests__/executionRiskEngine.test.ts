import { describe, expect, it } from "vitest";
import { DEFAULT_DISPATCH_GRAPH } from "../executionDependencies";
import { evaluateLaneStates } from "../executionBlocking";
import { summarizeExecutionRisk } from "../executionRiskEngine";

describe("summarizeExecutionRisk", () => {
  it("uses finance as root bottleneck when finance is pending and downstream lanes are blocked", () => {
    const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, {
      financeVerified: false,
      productionReady: true,
      packingComplete: true,
      barcodeReady: true,
      dispatchLabelReady: true,
    });
    const risk = summarizeExecutionRisk(states);
    expect(states.find((s) => s.lane === "finance")?.state).toBe("pending");
    expect(states.find((s) => s.lane === "production")?.state).toBe("blocked");
    expect(states.find((s) => s.lane === "production")?.blockedBy).toEqual(["finance"]);
    expect(risk.rootCauseLane).toBe("finance");
    expect(risk.bottleneckLane).toBe("finance");
    expect(risk.visibleBlockedLane).toBe("production");
    expect(risk.dependencyContext).toContain("Finance hold blocking downstream");
  });

  it("when finance is clear, root cause is the shallowest pending lane (not first blocked downstream)", () => {
    const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, {
      financeVerified: true,
      productionReady: false,
      packingComplete: true,
      barcodeReady: true,
      dispatchLabelReady: true,
    });
    const risk = summarizeExecutionRisk(states);
    expect(risk.rootCauseLane).toBe("production");
    expect(risk.bottleneckLane).toBe("production");
    expect(risk.dependencyContext).toContain("production");
    expect(states.some((s) => s.state === "blocked")).toBe(true);
  });

  it("returns nominal summary when all lanes are ready", () => {
    const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, {
      financeVerified: true,
      productionReady: true,
      packingComplete: true,
      barcodeReady: true,
      dispatchLabelReady: true,
    });
    const risk = summarizeExecutionRisk(states);
    expect(risk.blockedLanes).toBe(0);
    expect(risk.pendingLanes).toBe(0);
    expect(risk.rootCauseLane).toBeNull();
    expect(risk.dependencyContext).toBeNull();
  });
});
