import type { LaneState } from "./executionStates";

export interface ExecutionTimelineRow {
  id: string;
  title: string;
  detail: string;
  occurredAt: null;
}

export function buildExecutionTimeline(states: LaneState[]): ExecutionTimelineRow[] {
  return states.map((s, i) => ({
    id: `exec-timeline:${s.lane}:${i}`,
    title: `${s.lane} · ${s.state}`,
    detail: s.reason ?? "No extra detail",
    occurredAt: null,
  }));
}
