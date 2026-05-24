import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import type { ExecutionQueueAction } from "./executionAuthorityTypes";

/** Queue types a department-scoped role may touch. */
export const QUEUE_TYPE_BY_DEPARTMENT_ROLE: Partial<Record<string, WorkQueueId[]>> = {
  PRODUCTION_MANAGER: ["production_queue", "assembly_queue"],
  ASSEMBLY_MANAGER: ["assembly_queue", "production_queue"],
  HOD_ARABIC: ["production_queue"],
  HOD_FUSION: ["production_queue"],
  HOD_CHOCOLATE: ["production_queue"],
  HOD_BAKERY: ["production_queue"],
  HOD_NUTS: ["production_queue"],
  HOD_ASSEMBLY: ["assembly_queue", "production_queue"],
  HOD_DRAGEES: ["production_queue"],
  DISPATCH_MANAGER: ["dispatch_queue", "retail_followup_queue", "scan_exception_queue"],
  DISPATCH_INCHARGE: ["dispatch_queue", "scan_exception_queue"],
  DISPATCH_HEAD: ["dispatch_queue", "retail_followup_queue", "scan_exception_queue"],
  STORE_INCHARGE: ["inventory_verification_queue", "retail_followup_queue", "reservation_verification_queue"],
  STORE_READY_GOODS: ["inventory_verification_queue", "retail_followup_queue"],
  RGS_ADMIN: ["inventory_verification_queue", "retail_followup_queue"],
  SUPPORT_EXECUTIVE: ["customer_support_queue"],
  FINANCE_HEAD: ["finance_review_queue", "governance_review_queue"],
  FINANCE_EXEC: ["finance_review_queue"],
  OPERATIONS_MANAGER: [
    "finance_review_queue",
    "production_queue",
    "assembly_queue",
    "dispatch_queue",
    "retail_followup_queue",
    "reservation_verification_queue",
    "governance_review_queue",
    "inventory_verification_queue",
    "scan_exception_queue",
    "customer_support_queue",
  ],
};

const FORBIDDEN_ACTION_PREFIXES = [
  "finance:approve",
  "finance:release",
  "stock:",
  "dispatch:complete",
  "payment:",
  "invoice:",
  "notification:",
] as const;

export function isKnownQueueAction(action: string): action is ExecutionQueueAction {
  return (
    action === "queue:create" ||
    action === "queue:acknowledge" ||
    action === "queue:assign" ||
    action === "queue:start" ||
    action === "queue:block" ||
    action === "queue:escalate" ||
    action === "queue:complete" ||
    action === "queue:fail" ||
    action === "queue:cancel" ||
    action === "queue:note"
  );
}

export function roleHasQueueScope(role: string, queueType?: WorkQueueId): boolean {
  const normalized = role.trim().toUpperCase();
  if (normalized === "SUPER_ADMIN" || normalized === "ADMIN") return true;
  if (!queueType) return normalized === "OPERATIONS_MANAGER";
  const allowed = QUEUE_TYPE_BY_DEPARTMENT_ROLE[normalized];
  if (!allowed) return false;
  return allowed.includes(queueType);
}

export function isForbiddenBusinessAction(action: string): boolean {
  return FORBIDDEN_ACTION_PREFIXES.some((p) => action.startsWith(p));
}
