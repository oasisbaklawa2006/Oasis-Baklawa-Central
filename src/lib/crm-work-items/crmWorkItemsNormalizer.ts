import type {
  ClientInteractionFollowUpRow,
  CrmTaskRow,
  CrmWorkItemAuditEvent,
  CrmWorkItemEntry,
  CrmWorkItemKind,
  CrmWorkItemKindGovernance,
  CrmWorkItemsReadModel,
} from "./crmWorkItemsTypes";

/** Machine-readable audit trail suffix — preserves prior due dates without schema migration. */
export const CRM_WORK_ITEM_AUDIT_MARKER = "<!-- crm_work_item_audit:";

export const GOVERNED_TASK_KINDS: CrmWorkItemKind[] = [
  "follow_up",
  "repeat_contact",
  "sample",
  "opportunity",
];

export function buildCrmWorkItemKindGovernance(): CrmWorkItemKindGovernance[] {
  return [
    { kind: "follow_up", availability: "available", programmeOwner: "POINT63" },
    { kind: "repeat_contact", availability: "available", programmeOwner: "POINT63" },
    { kind: "sample", availability: "available", programmeOwner: "POINT63" },
    {
      kind: "opportunity",
      availability: "partial",
      programmeOwner: "POINT63",
      reason:
        "Opportunity tasks track intent and due dates only. Deal value, probability, and pipeline stage are not governed in crm_tasks (Point64 health lane).",
    },
    {
      kind: "follow_up_commitment",
      availability: "partial",
      programmeOwner: "POINT62",
      reason:
        "Follow-up dates on interactions are read-only commitments until promoted to crm_tasks (Point62 action capture).",
    },
  ];
}

export function parseWorkItemAuditTrail(description: string | null): {
  userDescription: string | null;
  audit: CrmWorkItemAuditEvent[];
} {
  if (!description) return { userDescription: null, audit: [] };

  const markerIndex = description.indexOf(CRM_WORK_ITEM_AUDIT_MARKER);
  if (markerIndex === -1) {
    return { userDescription: description.trim() || null, audit: [] };
  }

  const userDescription = description.slice(0, markerIndex).trim() || null;
  const suffix = description.slice(markerIndex + CRM_WORK_ITEM_AUDIT_MARKER.length);
  const jsonEnd = suffix.indexOf(" -->");
  if (jsonEnd === -1) {
    return { userDescription, audit: [] };
  }

  try {
    const parsed = JSON.parse(suffix.slice(0, jsonEnd)) as CrmWorkItemAuditEvent[];
    return { userDescription, audit: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { userDescription, audit: [] };
  }
}

export function appendWorkItemAuditTrail(
  description: string | null,
  events: CrmWorkItemAuditEvent[],
): string {
  const { userDescription, audit } = parseWorkItemAuditTrail(description);
  const merged = [...audit, ...events];
  const base = userDescription ?? "";
  const auditSuffix = `${CRM_WORK_ITEM_AUDIT_MARKER}${JSON.stringify(merged)} -->`;
  return base ? `${base}\n${auditSuffix}` : auditSuffix;
}

export function normalizeTaskKind(taskType: string | null): CrmWorkItemKind {
  const normalized = (taskType ?? "").trim().toLowerCase();
  switch (normalized) {
    case "follow_up":
      return "follow_up";
    case "repeat_contact":
      return "repeat_contact";
    case "sample":
      return "sample";
    case "opportunity":
      return "opportunity";
    default:
      return "follow_up";
  }
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isOverdue(dueDate: string, referenceDate: string): boolean {
  return compareIsoDates(dueDate, referenceDate) < 0;
}

export function resolveDisplayStatus(
  lifecycleStatus: string | null,
  dueDate: string,
  referenceDate: string,
): "pending" | "completed" | "overdue" {
  if (lifecycleStatus === "completed") return "completed";
  if (isOverdue(dueDate, referenceDate)) return "overdue";
  return "pending";
}

export function taskKindLabel(kind: CrmWorkItemKind): string {
  switch (kind) {
    case "follow_up":
      return "Follow-up";
    case "repeat_contact":
      return "Repeat contact";
    case "sample":
      return "Sample";
    case "opportunity":
      return "Opportunity";
    case "follow_up_commitment":
      return "Follow-up commitment";
    default:
      return "Work item";
  }
}

export function normalizeCrmTaskRow(
  row: CrmTaskRow,
  companyId: string,
  referenceDate: string,
): CrmWorkItemEntry | null {
  if (!row.company_id || row.company_id.toLowerCase() !== companyId.toLowerCase()) {
    return null;
  }
  if (!row.sales_exec_id) {
    return null;
  }

  const kind = normalizeTaskKind(row.task_type);
  const lifecycleStatus = row.status === "completed" ? "completed" : "pending";
  const displayStatus = resolveDisplayStatus(row.status, row.due_date, referenceDate);
  const { userDescription, audit } = parseWorkItemAuditTrail(row.description);
  const isOpen = lifecycleStatus === "pending";

  return {
    itemId: `task:${row.id}`,
    companyId: companyId.toLowerCase(),
    kind,
    lifecycleStatus,
    displayStatus,
    ownerExecutiveId: row.sales_exec_id,
    dueDate: row.due_date,
    summary: `${taskKindLabel(kind)} · ${displayStatus}`,
    detail: userDescription,
    isOpen,
    isOverdue: isOpen && displayStatus === "overdue",
    dueDateAudit: audit,
    provenance: "crm_task_manual",
    source: {
      authority: "crm_tasks",
      table: "crm_tasks",
      recordId: row.id,
    },
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function normalizeFollowUpCommitmentRow(
  row: ClientInteractionFollowUpRow,
  companyId: string,
  referenceDate: string,
  promotedInteractionIds: Set<string>,
): CrmWorkItemEntry | null {
  if (!row.company_id || row.company_id.toLowerCase() !== companyId.toLowerCase()) {
    return null;
  }
  if (!row.follow_up_date) return null;
  if (promotedInteractionIds.has(row.id)) return null;

  const displayStatus = isOverdue(row.follow_up_date, referenceDate) ? "overdue" : "pending";

  return {
    itemId: `commitment:${row.id}`,
    companyId: companyId.toLowerCase(),
    kind: "follow_up_commitment",
    lifecycleStatus: null,
    displayStatus,
    ownerExecutiveId: row.executive_id,
    dueDate: row.follow_up_date,
    summary: `Follow-up commitment · ${displayStatus}`,
    detail: row.notes,
    isOpen: true,
    isOverdue: displayStatus === "overdue",
    dueDateAudit: [],
    provenance: "interaction_follow_up_commitment",
    source: {
      authority: "client_interactions",
      table: "client_interactions",
      recordId: row.id,
    },
    createdAt: row.created_at,
    completedAt: null,
  };
}

export function sortWorkItemsByDueDate<T extends { dueDate: string | null; itemId: string }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftDue = left.dueDate ?? "9999-12-31";
    const rightDue = right.dueDate ?? "9999-12-31";
    const dueDelta = compareIsoDates(leftDue, rightDue);
    if (dueDelta !== 0) return dueDelta;
    return left.itemId.localeCompare(right.itemId);
  });
}

export function buildWorkItemsReadModelFromRows(
  companyId: string,
  taskRows: CrmTaskRow[],
  interactionRows: ClientInteractionFollowUpRow[],
  referenceDate: string,
): CrmWorkItemsReadModel {
  const normalizedCompanyId = companyId.toLowerCase();

  const taskEntries = taskRows
    .map((row) => normalizeCrmTaskRow(row, normalizedCompanyId, referenceDate))
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const promotedInteractionIds = new Set(
    taskEntries
      .filter((entry) => entry.provenance === "crm_task_from_interaction")
      .map((entry) => entry.source.recordId),
  );

  const commitmentEntries = interactionRows
    .map((row) =>
      normalizeFollowUpCommitmentRow(row, normalizedCompanyId, referenceDate, promotedInteractionIds),
    )
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const openItems = sortWorkItemsByDueDate(taskEntries.filter((entry) => entry.isOpen));
  const historyItems = sortWorkItemsByDueDate(
    taskEntries
      .filter((entry) => !entry.isOpen)
      .sort((left, right) => {
        const leftCompleted = left.completedAt ?? left.createdAt ?? "";
        const rightCompleted = right.completedAt ?? right.createdAt ?? "";
        return rightCompleted.localeCompare(leftCompleted);
      }),
  );

  return {
    companyId: normalizedCompanyId,
    resolvedAt: new Date().toISOString(),
    openItems,
    historyItems,
    followUpCommitments: sortWorkItemsByDueDate(commitmentEntries),
    kinds: buildCrmWorkItemKindGovernance(),
  };
}
