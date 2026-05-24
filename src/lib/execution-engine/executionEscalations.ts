import type { LaneState } from "./executionStates";

export function deriveExecutionEscalations(states: LaneState[]): string[] {
  const msgs: string[] = [];
  for (const s of states) {
    if (s.state === "blocked") msgs.push(`${s.lane} blocked — ${s.reason ?? "dependency"}`);
  }
  return msgs;
}
