/**
 * Point 63 — company-scoped CRM work-item contract.
 * Canonical task authority is `crm_tasks` (Core). Follow-up commitments are
 * projected read-only from `client_interactions.follow_up_date`.
 * This module does not create a second task master.
 */

export type CrmWorkItemKind =
  | "follow_up"
  | "repeat_contact"
  | "sample"
  | "opportunity"
  | "follow_up_commitment";

export type CrmWorkItemLifecycleStatus = "pending" | "completed";

export type CrmWorkItemDisplayStatus = CrmWorkItemLifecycleStatus | "overdue";

export type CrmWorkItemSourceAuthority = "crm_tasks" | "client_interactions";

export type CrmWorkItemKindAvailability =
  | "available"
  | "partial"
  | "unavailable_not_governed";

export type CrmWorkItemKindGovernance = {
  kind: CrmWorkItemKind;
  availability: CrmWorkItemKindAvailability;
  programmeOwner: string;
  reason?: string;
};

export type CrmWorkItemAuditAction = "created" | "snooze" | "reschedule" | "complete";

export type CrmWorkItemAuditEvent = {
  action: CrmWorkItemAuditAction;
  fromDueDate?: string;
  toDueDate?: string;
  at: string;
  byExecutiveId: string;
  reason?: string;
};

export type CrmWorkItemProvenance =
  | "crm_task_manual"
  | "crm_task_from_interaction"
  | "interaction_follow_up_commitment";

export type CrmWorkItemEntry = {
  /** Stable key within a company-scoped read. */
  itemId: string;
  companyId: string;
  kind: CrmWorkItemKind;
  lifecycleStatus: CrmWorkItemLifecycleStatus | null;
  displayStatus: CrmWorkItemDisplayStatus;
  ownerExecutiveId: string | null;
  dueDate: string | null;
  summary: string;
  detail: string | null;
  isOpen: boolean;
  isOverdue: boolean;
  dueDateAudit: CrmWorkItemAuditEvent[];
  provenance: CrmWorkItemProvenance;
  source: {
    authority: CrmWorkItemSourceAuthority;
    table: string;
    recordId: string;
  };
  createdAt: string | null;
  completedAt: string | null;
};

export type CrmWorkItemsReadModel = {
  companyId: string;
  resolvedAt: string;
  /** Governed open/current work items only (pending + overdue). */
  openItems: CrmWorkItemEntry[];
  /** Completed tasks — audit/history lane, not actionable in Customer 360. */
  historyItems: CrmWorkItemEntry[];
  /** Interaction follow-up dates not yet promoted to a crm_task (read-only). */
  followUpCommitments: CrmWorkItemEntry[];
  kinds: CrmWorkItemKindGovernance[];
};

export type CrmTaskRow = {
  id: string;
  company_id: string | null;
  sales_exec_id: string | null;
  task_type: string | null;
  status: string | null;
  due_date: string;
  description: string | null;
  completed_at: string | null;
  created_at: string | null;
};

export type ClientInteractionFollowUpRow = {
  id: string;
  company_id: string | null;
  executive_id: string | null;
  interaction_type: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string | null;
};

export type CreateCrmWorkItemInput = {
  companyId: string;
  ownerExecutiveId: string;
  kind: Exclude<CrmWorkItemKind, "follow_up_commitment">;
  dueDate: string;
  description?: string | null;
  provenance?: CrmWorkItemProvenance;
};

export type SnoozeCrmWorkItemInput = {
  task: CrmTaskRow;
  newDueDate: string;
  actorExecutiveId: string;
  reason?: string;
};

export type CompleteCrmWorkItemInput = {
  task: CrmTaskRow;
  actorExecutiveId: string;
};

export type CrmWorkItemContractErrorCode =
  | "missing_company"
  | "missing_owner"
  | "invalid_kind"
  | "invalid_due_date"
  | "cross_company_mismatch"
  | "invalid_status_transition"
  | "fabricated_commercial_facts"
  | "snooze_not_open"
  | "snooze_backward_date";
