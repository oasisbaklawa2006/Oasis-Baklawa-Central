import type { LaneState } from "./executionStates";

export interface ExecutionRiskSummary {
  blockedLanes: number;
  pendingLanes: number;
  bottleneckLane: string | null;
}

export function summarizeExecutionRisk(states: LaneState[]): ExecutionRiskSummary {
  const blocked = states.filter((s) => s.state === "blocked").length;
  const pending = states.filter((s) => s.state === "pending").length;
  const firstBlocked = states.find((s) => s.state === "blocked");
  return {
    blockedLanes: blocked,
    pendingLanes: pending,
    bottleneckLane: firstBlocked?.lane ?? null,
  };
}
