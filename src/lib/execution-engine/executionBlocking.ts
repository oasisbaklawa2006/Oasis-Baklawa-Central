import type { ExecutionDependency, ExecutionLane } from "./executionDependencies";
import type { LaneState, ExecutionReadiness } from "./executionStates";

export interface ExecutionSatisfaction {
  financeVerified: boolean;
  productionReady: boolean;
  packingComplete: boolean;
  barcodeReady: boolean;
  dispatchLabelReady: boolean;
}

function laneSatisfied(lane: ExecutionLane, s: ExecutionSatisfaction): boolean {
  switch (lane) {
    case "finance":
      return s.financeVerified;
    case "production":
      return s.productionReady;
    case "packing":
      return s.packingComplete;
    case "barcode":
      return s.barcodeReady;
    case "dispatch":
      return s.dispatchLabelReady;
    default:
      return false;
  }
}

export function evaluateLaneStates(graph: ExecutionDependency[], s: ExecutionSatisfaction): LaneState[] {
  return graph.map((node) => {
    const blockedBy = node.dependsOn.filter((d) => !laneSatisfied(d, s));
    let state: ExecutionReadiness = "ready";
    let reason: string | undefined;
    if (blockedBy.length > 0) {
      state = "blocked";
      reason = `Waiting on: ${blockedBy.join(", ")}`;
    } else if (!laneSatisfied(node.lane, s)) {
      state = "pending";
      reason = `${node.lane} not satisfied`;
    }
    return { lane: node.lane, state, reason };
  });
}

export function isDispatchLaneBlocked(states: LaneState[]): boolean {
  const d = states.find((x) => x.lane === "dispatch");
  return d?.state === "blocked" || d?.state === "pending";
}
