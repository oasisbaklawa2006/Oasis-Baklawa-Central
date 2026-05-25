import { roleHasQueueScope } from "@/lib/execution-authority/executionAuthorityMatrix";
import type { WorkQueueId } from "@/lib/work-queues/queueTypes";

/** Whether role may execute queue actions for this queue type (client-side UX gate; server enforced in service). */
export function canExecuteOnQueue(role: string | null | undefined, queueType: WorkQueueId): boolean {
  if (!role) return false;
  const normalized = role.trim().toUpperCase();
  if (normalized === "SUPER_ADMIN" || normalized === "OPERATIONS_MANAGER") return true;
  if (normalized === "ADMIN") return true;
  return roleHasQueueScope(normalized, queueType);
}

export function canExecuteOnBoard(role: string | null | undefined, queueTypes: WorkQueueId[]): boolean {
  return queueTypes.some((qt) => canExecuteOnQueue(role, qt));
}
