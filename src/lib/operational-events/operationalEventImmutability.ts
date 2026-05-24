export type EventMutationOp = "insert" | "update" | "delete";

export function assertAppendOnlyMutation(op: EventMutationOp): void {
  if (op !== "insert") {
    throw new Error(`operational_events are append-only; rejected ${op}`);
  }
}

export function rejectEventUpdateDelete(): never {
  throw new Error("operational_events are append-only");
}
