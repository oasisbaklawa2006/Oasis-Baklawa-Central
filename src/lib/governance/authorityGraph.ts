export type GovernanceActor = "operator" | "hod" | "finance" | "cmd" | "super_admin";

export interface AuthorityEdge {
  from: GovernanceActor;
  to: GovernanceActor;
  relation: "reports_to" | "can_escalate_to";
}

/** Static authority edges for escalation design — not enforced at runtime here. */
export const DEFAULT_AUTHORITY_EDGES: AuthorityEdge[] = [
  { from: "operator", to: "hod", relation: "reports_to" },
  { from: "hod", to: "cmd", relation: "can_escalate_to" },
  { from: "finance", to: "cmd", relation: "can_escalate_to" },
  { from: "cmd", to: "super_admin", relation: "can_escalate_to" },
];
