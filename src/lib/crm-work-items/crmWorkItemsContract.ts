import {
  appendWorkItemAuditTrail,
  GOVERNED_TASK_KINDS,
  isValidIsoDate,
} from "./crmWorkItemsNormalizer";
import type {
  CompleteCrmWorkItemInput,
  CreateCrmWorkItemInput,
  CrmWorkItemContractErrorCode,
  SnoozeCrmWorkItemInput,
} from "./crmWorkItemsTypes";

export class CrmWorkItemContractError extends Error {
  readonly code: CrmWorkItemContractErrorCode;

  constructor(code: CrmWorkItemContractErrorCode, message: string) {
    super(message);
    this.name = "CrmWorkItemContractError";
    this.code = code;
  }
}

function assertCompanyId(companyId: string | null | undefined): string {
  const trimmed = companyId?.trim();
  if (!trimmed) {
    throw new CrmWorkItemContractError("missing_company", "Company identity is required for CRM work items.");
  }
  return trimmed.toLowerCase();
}

function assertOwnerId(ownerId: string | null | undefined): string {
  const trimmed = ownerId?.trim();
  if (!trimmed) {
    throw new CrmWorkItemContractError("missing_owner", "Owner/assignee executive identity is required.");
  }
  return trimmed;
}

function assertDueDate(dueDate: string): string {
  if (!isValidIsoDate(dueDate)) {
    throw new CrmWorkItemContractError("invalid_due_date", "Due date must be a valid ISO date (YYYY-MM-DD).");
  }
  return dueDate;
}

function assertTaskCompanyMatch(taskCompanyId: string | null, expectedCompanyId: string): void {
  if (!taskCompanyId || taskCompanyId.toLowerCase() !== expectedCompanyId.toLowerCase()) {
    throw new CrmWorkItemContractError(
      "cross_company_mismatch",
      "CRM work item company scope does not match the requested company.",
    );
  }
}

/** Reject fabricated commercial facts — crm_tasks has no governed value/probability columns. */
export function rejectFabricatedCommercialFacts(input: Record<string, unknown>): void {
  const forbidden = ["opportunityValue", "dealValue", "probability", "pipelineStage", "expectedRevenue"];
  for (const key of forbidden) {
    if (key in input && input[key] != null) {
      throw new CrmWorkItemContractError(
        "fabricated_commercial_facts",
        `Commercial fact '${key}' is not governed in crm_tasks authority.`,
      );
    }
  }
}

export function validateCreateWorkItemInput(input: CreateCrmWorkItemInput): CreateCrmWorkItemInput {
  rejectFabricatedCommercialFacts(input as unknown as Record<string, unknown>);

  const companyId = assertCompanyId(input.companyId);
  const ownerExecutiveId = assertOwnerId(input.ownerExecutiveId);
  const dueDate = assertDueDate(input.dueDate);

  if (!GOVERNED_TASK_KINDS.includes(input.kind)) {
    throw new CrmWorkItemContractError(
      "invalid_kind",
      `Task kind '${input.kind}' is not a governed CRM work item.`,
    );
  }

  return {
    ...input,
    companyId,
    ownerExecutiveId,
    dueDate,
    provenance: input.provenance ?? "crm_task_manual",
  };
}

export function buildCreateWorkItemInsertPayload(input: CreateCrmWorkItemInput) {
  const validated = validateCreateWorkItemInput(input);
  const now = new Date().toISOString();

  const description = appendWorkItemAuditTrail(validated.description ?? null, [
    {
      action: "created",
      toDueDate: validated.dueDate,
      at: now,
      byExecutiveId: validated.ownerExecutiveId,
    },
  ]);

  return {
    company_id: validated.companyId,
    sales_exec_id: validated.ownerExecutiveId,
    task_type: validated.kind,
    status: "pending",
    due_date: validated.dueDate,
    description,
  };
}

export function validateCompleteWorkItemInput(input: CompleteCrmWorkItemInput): CompleteCrmWorkItemInput {
  assertOwnerId(input.actorExecutiveId);
  if (input.task.status === "completed") {
    throw new CrmWorkItemContractError(
      "invalid_status_transition",
      "Completed CRM work items cannot be completed again.",
    );
  }
  if (input.task.status !== "pending") {
    throw new CrmWorkItemContractError(
      "invalid_status_transition",
      `Cannot complete CRM work item from status '${input.task.status ?? "unknown"}'.`,
    );
  }
  return input;
}

export function buildCompleteWorkItemUpdatePayload(input: CompleteCrmWorkItemInput) {
  const validated = validateCompleteWorkItemInput(input);
  const now = new Date().toISOString();

  const description = appendWorkItemAuditTrail(validated.task.description, [
    {
      action: "complete",
      fromDueDate: validated.task.due_date,
      at: now,
      byExecutiveId: validated.actorExecutiveId,
    },
  ]);

  return {
    status: "completed",
    completed_at: now,
    description,
  };
}

export function validateSnoozeWorkItemInput(input: SnoozeCrmWorkItemInput): SnoozeCrmWorkItemInput {
  assertOwnerId(input.actorExecutiveId);
  const newDueDate = assertDueDate(input.newDueDate);

  if (input.task.status !== "pending") {
    throw new CrmWorkItemContractError(
      "snooze_not_open",
      "Only open (pending) CRM work items can be snoozed or rescheduled.",
    );
  }

  if (newDueDate < input.task.due_date) {
    throw new CrmWorkItemContractError(
      "snooze_backward_date",
      "Snooze/reschedule must not move due date earlier than the current due date.",
    );
  }

  return { ...input, newDueDate };
}

export function buildSnoozeWorkItemUpdatePayload(input: SnoozeCrmWorkItemInput) {
  const validated = validateSnoozeWorkItemInput(input);
  const now = new Date().toISOString();
  const action = validated.newDueDate === validated.task.due_date ? "snooze" : "reschedule";

  const description = appendWorkItemAuditTrail(validated.task.description, [
    {
      action,
      fromDueDate: validated.task.due_date,
      toDueDate: validated.newDueDate,
      at: now,
      byExecutiveId: validated.actorExecutiveId,
      reason: validated.reason,
    },
  ]);

  return {
    due_date: validated.newDueDate,
    description,
  };
}

export function buildCreateTaskFromFollowUpPayload(
  interaction: {
    id: string;
    company_id: string | null;
    follow_up_date: string | null;
    notes: string | null;
  },
  ownerExecutiveId: string,
) {
  const companyId = assertCompanyId(interaction.company_id);
  const ownerId = assertOwnerId(ownerExecutiveId);
  if (!interaction.follow_up_date) {
    throw new CrmWorkItemContractError("invalid_due_date", "Follow-up commitment has no due date.");
  }

  return buildCreateWorkItemInsertPayload({
    companyId,
    ownerExecutiveId: ownerId,
    kind: "repeat_contact",
    dueDate: interaction.follow_up_date,
    description: interaction.notes
      ? `Repeat contact: ${interaction.notes}`
      : "Repeat contact from CRM follow-up",
    provenance: "crm_task_from_interaction",
  });
}
