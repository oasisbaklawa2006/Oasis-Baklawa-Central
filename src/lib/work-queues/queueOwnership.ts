import type { WorkQueueId } from "./queueTypes";
import type { OperationalOwnerRole } from "@/lib/entity-graph/entityOwnership";

export interface QueueOwnershipContract {
  queueId: WorkQueueId;
  ownerRole: OperationalOwnerRole;
  backupRole?: OperationalOwnerRole;
}

export const QUEUE_OWNERSHIP_MATRIX: QueueOwnershipContract[] = [
  { queueId: "finance_review_queue", ownerRole: "finance_head", backupRole: "finance_exec" },
  { queueId: "production_queue", ownerRole: "production_manager" },
  { queueId: "assembly_queue", ownerRole: "assembly_manager" },
  { queueId: "dispatch_queue", ownerRole: "dispatch_manager", backupRole: "dispatch_incharge" },
  { queueId: "retail_followup_queue", ownerRole: "store_incharge" },
  { queueId: "reservation_verification_queue", ownerRole: "store_incharge", backupRole: "operations_manager" },
  { queueId: "governance_review_queue", ownerRole: "finance_head", backupRole: "cmd_escalation" },
  { queueId: "inventory_verification_queue", ownerRole: "store_incharge" },
  { queueId: "scan_exception_queue", ownerRole: "security_control" },
  { queueId: "customer_support_queue", ownerRole: "support_executive" },
];

export function ownershipForQueue(queueId: WorkQueueId): QueueOwnershipContract | undefined {
  return QUEUE_OWNERSHIP_MATRIX.find((c) => c.queueId === queueId);
}
