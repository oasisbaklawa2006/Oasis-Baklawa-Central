import type { QueueItemDependencyState, DependencyState } from "./queueTypes";

export interface QueueDependencyInput {
  upstreamLabel: string;
  upstreamSatisfied: boolean;
  downstreamLabel: string;
}

export function projectQueueDependency(input: QueueDependencyInput): QueueItemDependencyState {
  if (input.upstreamSatisfied) {
    return { state: "satisfied" };
  }
  return {
    state: "blocked",
    waitingOn: input.upstreamLabel,
    downstreamImpact: `${input.downstreamLabel} cannot proceed until ${input.upstreamLabel} is satisfied`,
  };
}

export function mergeDependencyStates(states: QueueItemDependencyState[]): QueueItemDependencyState {
  if (states.some((s) => s.state === "blocked")) {
    const blocked = states.find((s) => s.state === "blocked");
    return blocked ?? { state: "blocked", waitingOn: "upstream" };
  }
  if (states.some((s) => s.state === "waiting")) {
    return { state: "waiting", waitingOn: states.find((s) => s.waitingOn)?.waitingOn };
  }
  return { state: "satisfied" };
}
