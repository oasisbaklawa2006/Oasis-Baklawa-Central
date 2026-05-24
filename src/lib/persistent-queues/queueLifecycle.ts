import type { PersistentQueueState } from "./persistentQueueTypes";

export type QueueLifecycleAction =
  | "acknowledge"
  | "assign"
  | "start"
  | "block"
  | "unblock"
  | "escalate"
  | "de_escalate"
  | "complete"
  | "fail"
  | "cancel"
  | "retry";

const TRANSITIONS: Record<PersistentQueueState, Partial<Record<QueueLifecycleAction, PersistentQueueState>>> = {
  pending: {
    acknowledge: "acknowledged",
    assign: "assigned",
    cancel: "cancelled",
  },
  acknowledged: {
    assign: "assigned",
    cancel: "cancelled",
  },
  assigned: {
    start: "in_progress",
    cancel: "cancelled",
  },
  in_progress: {
    block: "blocked",
    escalate: "escalated",
    complete: "completed",
    fail: "failed",
  },
  blocked: {
    unblock: "in_progress",
    escalate: "escalated",
    cancel: "cancelled",
  },
  escalated: {
    de_escalate: "in_progress",
    complete: "completed",
    fail: "failed",
  },
  completed: {},
  failed: {
    retry: "pending",
  },
  cancelled: {},
};

export interface QueueTransitionInput {
  from: PersistentQueueState;
  action: QueueLifecycleAction;
}

export interface QueueTransitionResult {
  ok: true;
  to: PersistentQueueState;
}

export interface QueueTransitionError {
  ok: false;
  code: "illegal_transition";
  message: string;
}

export function applyQueueLifecycleTransition(
  input: QueueTransitionInput,
): QueueTransitionResult | QueueTransitionError {
  const next = TRANSITIONS[input.from]?.[input.action];
  if (!next) {
    return {
      ok: false,
      code: "illegal_transition",
      message: `Cannot ${input.action} from state ${input.from}`,
    };
  }
  return { ok: true, to: next };
}

export function isTerminalQueueState(state: PersistentQueueState): boolean {
  return state === "completed" || state === "cancelled";
}

export function isOpenQueueState(state: PersistentQueueState): boolean {
  return !isTerminalQueueState(state) && state !== "failed";
}
