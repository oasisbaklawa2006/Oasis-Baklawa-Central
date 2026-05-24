import type { OperationalStoreEventType } from "@/lib/operational-events/operationalEventTypes";
import type { QueueLifecycleAction } from "./queueLifecycle";
import type { PersistentQueueState } from "./persistentQueueTypes";

export function lifecycleActionToEventType(action: QueueLifecycleAction): OperationalStoreEventType {
  const map: Partial<Record<QueueLifecycleAction, OperationalStoreEventType>> = {
    acknowledge: "queue_acknowledged",
    assign: "queue_assigned",
    start: "queue_started",
    block: "queue_blocked",
    escalate: "queue_escalated",
    complete: "queue_completed",
    fail: "queue_failed",
    cancel: "queue_cancelled",
    retry: "queue_created",
  };
  const ev = map[action];
  if (!ev) throw new Error(`No event type for lifecycle action: ${action}`);
  return ev;
}

export function authorityActionForLifecycle(action: QueueLifecycleAction): string {
  const map: Partial<Record<QueueLifecycleAction, string>> = {
    acknowledge: "queue:acknowledge",
    assign: "queue:assign",
    start: "queue:start",
    block: "queue:block",
    unblock: "queue:start",
    escalate: "queue:escalate",
    de_escalate: "queue:escalate",
    complete: "queue:complete",
    fail: "queue:fail",
    cancel: "queue:cancel",
    retry: "queue:create",
  };
  return map[action] ?? "queue:note";
}

export function terminalTimestampsForState(
  state: PersistentQueueState,
  nowIso: string,
): { completedAt: string | null; cancelledAt: string | null } {
  if (state === "completed") return { completedAt: nowIso, cancelledAt: null };
  if (state === "cancelled") return { completedAt: null, cancelledAt: nowIso };
  return { completedAt: null, cancelledAt: null };
}
