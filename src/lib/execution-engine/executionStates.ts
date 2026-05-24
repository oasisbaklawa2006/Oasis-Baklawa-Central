import type { ExecutionLane } from "./executionDependencies";

export type ExecutionReadiness = "blocked" | "pending" | "ready";

export interface LaneState {
  lane: ExecutionLane;
  state: ExecutionReadiness;
  reason?: string;
}
