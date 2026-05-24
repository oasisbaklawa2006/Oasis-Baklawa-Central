import type { WorkQueueId } from "./queueTypes";
import type { EscalationTier, OperationalSeverity } from "@/lib/entity-graph/entityEscalation";
import { deriveEntityEscalation } from "@/lib/entity-graph/entityEscalation";
import type { CanonicalEntityType } from "@/lib/entity-graph/entityTypes";

export interface QueueEscalationProjection {
  tier: EscalationTier;
  severity: OperationalSeverity;
  recommendation: string;
}

const QUEUE_ESCALATION_TRIGGERS: Partial<Record<WorkQueueId, { entityType: CanonicalEntityType; trigger: string }>> = {
  finance_review_queue: { entityType: "approval_request", trigger: "finance_hold_stale" },
  dispatch_queue: { entityType: "dispatch", trigger: "dispatch_panic" },
  scan_exception_queue: { entityType: "scan_event", trigger: "scan_exception" },
  reservation_verification_queue: { entityType: "reservation", trigger: "inventory_unverified" },
  customer_support_queue: { entityType: "whatsapp_packet", trigger: "stale_idle" },
  production_queue: { entityType: "factory_followup", trigger: "production_slip" },
};

export function projectQueueEscalation(
  queueId: WorkQueueId,
  entityId: string,
): QueueEscalationProjection {
  const mapping = QUEUE_ESCALATION_TRIGGERS[queueId];
  if (!mapping) {
    return { tier: "none", severity: "low", recommendation: "No escalation rule for this queue — monitor manually." };
  }
  const state = deriveEntityEscalation(mapping.entityType, entityId, mapping.trigger);
  if (!state) {
    return { tier: "none", severity: "low", recommendation: "No escalation rule matched." };
  }
  return {
    tier: state.tier,
    severity: state.severity,
    recommendation: state.recommendation,
  };
}
