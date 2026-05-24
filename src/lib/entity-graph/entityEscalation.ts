import type { CanonicalEntityType } from "./entityTypes";
import type { OperationalOwnerRole } from "./entityOwnership";

export type EscalationTier = "none" | "team_lead" | "department_head" | "cmd";

export type OperationalSeverity = "low" | "medium" | "high" | "critical";

export interface EntityEscalationRule {
  entityType: CanonicalEntityType;
  trigger: string;
  tier: EscalationTier;
  targetRole: OperationalOwnerRole;
  severity: OperationalSeverity;
  customerImpact: boolean;
}

export const ENTITY_ESCALATION_RULES: EntityEscalationRule[] = [
  { entityType: "approval_request", trigger: "finance_hold_stale", tier: "department_head", targetRole: "finance_head", severity: "high", customerImpact: true },
  { entityType: "dispatch", trigger: "dispatch_panic", tier: "cmd", targetRole: "cmd_escalation", severity: "critical", customerImpact: true },
  { entityType: "scan_event", trigger: "scan_exception", tier: "team_lead", targetRole: "security_control", severity: "medium", customerImpact: false },
  { entityType: "reservation", trigger: "inventory_unverified", tier: "department_head", targetRole: "store_incharge", severity: "high", customerImpact: true },
  { entityType: "whatsapp_packet", trigger: "stale_idle", tier: "team_lead", targetRole: "support_executive", severity: "medium", customerImpact: true },
  { entityType: "factory_followup", trigger: "production_slip", tier: "department_head", targetRole: "production_manager", severity: "high", customerImpact: true },
  { entityType: "payment", trigger: "invoice_unsettled", tier: "team_lead", targetRole: "finance_exec", severity: "medium", customerImpact: false },
];

export interface EntityEscalationState {
  entityType: CanonicalEntityType;
  entityId: string;
  tier: EscalationTier;
  severity: OperationalSeverity;
  customerImpact: boolean;
  recommendation: string;
}

export function deriveEntityEscalation(
  entityType: CanonicalEntityType,
  entityId: string,
  trigger: string,
): EntityEscalationState | null {
  const rule = ENTITY_ESCALATION_RULES.find((r) => r.entityType === entityType && r.trigger === trigger);
  if (!rule) return null;
  return {
    entityType,
    entityId,
    tier: rule.tier,
    severity: rule.severity,
    customerImpact: rule.customerImpact,
    recommendation: `Escalate ${entityType} (${entityId}) to ${rule.targetRole.replace(/_/g, " ")} — ${rule.trigger}. No auto-escalation.`,
  };
}

export function maxSeverity(a: OperationalSeverity, b: OperationalSeverity): OperationalSeverity {
  const order: OperationalSeverity[] = ["low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}
