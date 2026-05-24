import type { WorkQueueId } from "@/lib/work-queues/queueTypes";

export const EXECUTION_QUEUE_ACTIONS = [
  "queue:create",
  "queue:acknowledge",
  "queue:assign",
  "queue:start",
  "queue:block",
  "queue:escalate",
  "queue:complete",
  "queue:fail",
  "queue:cancel",
  "queue:note",
] as const;

export type ExecutionQueueAction = (typeof EXECUTION_QUEUE_ACTIONS)[number];

export interface ExecutionAuthorityContext {
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  queueType?: WorkQueueId;
  idempotencyKey?: string | null;
}

export interface ExecutionAuthorityDecision {
  allowed: boolean;
  reason?: string;
}
