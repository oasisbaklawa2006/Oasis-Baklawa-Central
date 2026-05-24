import type { ExecutionLane } from "./executionDependencies";

export type ExecutionReadiness = "blocked" | "pending" | "ready";

export interface LaneState {
  lane: ExecutionLane;
  state: ExecutionReadiness;
  reason?: string;
  /** Unsatisfied upstream lanes (from graph `dependsOn`); empty when not blocked by dependencies. */
  blockedBy: ExecutionLane[];
}
