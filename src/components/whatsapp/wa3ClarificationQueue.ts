export type Wa3ResolutionState =
  | "resolved"
  | "unresolved"
  | "ambiguous"
  | "conflicting"
  | "awaiting_clarification"
  | "operator_confirmed"
  | "not_applicable";

export type Wa3FieldResolution = { resolution_state: Wa3ResolutionState };
export type Wa3ClarificationTask = { status: "OPEN" | "ANSWERED" | "SUPERSEDED" | "CANCELLED"; due_at: string };

export function summarizeWa3ClarificationQueue(
  resolutions: Wa3FieldResolution[],
  tasks: Wa3ClarificationTask[],
  nowMs = Date.now(),
) {
  const open = tasks.filter((task) => task.status === "OPEN");
  return {
    unresolved: resolutions.filter((row) => ["unresolved", "ambiguous", "conflicting", "awaiting_clarification"].includes(row.resolution_state)).length,
    conflicting: resolutions.filter((row) => row.resolution_state === "conflicting").length,
    open: open.length,
    overdue: open.filter((task) => new Date(task.due_at).getTime() < nowMs).length,
  };
}
