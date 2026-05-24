import type { LaneState } from "./executionStates";

export interface ExecutionRiskSummary {
  blockedLanes: number;
  pendingLanes: number;
  /**
   * Root-cause lane for bottleneck display: shallowest **pending** lane in graph order, else first **blocked** lane.
   * When finance is pending, this is `finance` even though downstream lanes show as blocked — avoids misreading a production/packing label as the root issue.
   */
  bottleneckLane: string | null;
  /** First blocked lane in graph order (downstream context). */
  visibleBlockedLane: string | null;
  /** Same as `bottleneckLane` (explicit name for callers). */
  rootCauseLane: string | null;
  /** Short explanation for pulse / feeds (e.g. finance blocking downstream). */
  dependencyContext: string | null;
}

export function summarizeExecutionRisk(states: LaneState[]): ExecutionRiskSummary {
  const blockedStates = states.filter((s) => s.state === "blocked");
  const pendingStates = states.filter((s) => s.state === "pending");
  const blockedLanes = blockedStates.length;
  const pendingLanes = pendingStates.length;

  const firstPending = states.find((s) => s.state === "pending");
  const firstBlocked = states.find((s) => s.state === "blocked");

  const rootCauseLane = firstPending?.lane ?? firstBlocked?.lane ?? null;
  const visibleBlockedLane = firstBlocked?.lane ?? null;

  let dependencyContext: string | null = null;
  if (rootCauseLane === "finance") {
    if (blockedStates.length > 0) {
      dependencyContext = `Finance hold blocking downstream lanes (${blockedStates.map((b) => b.lane).join(", ")})`;
    } else {
      dependencyContext = "Finance verification pending";
    }
  } else if (rootCauseLane) {
    if (firstPending?.lane === rootCauseLane) {
      dependencyContext = `${rootCauseLane} readiness pending`;
    } else if (firstBlocked) {
      dependencyContext = firstBlocked.reason ?? `${rootCauseLane} blocked`;
    }
  }

  return {
    blockedLanes,
    pendingLanes,
    bottleneckLane: rootCauseLane,
    visibleBlockedLane,
    rootCauseLane,
    dependencyContext,
  };
}
