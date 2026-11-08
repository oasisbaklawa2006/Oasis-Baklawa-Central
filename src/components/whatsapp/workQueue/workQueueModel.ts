/**
 * Pure view-model for the WhatsApp work queue (Needs Action / My Tasks / Waiting / Completed).
 * No I/O: everything the screen shows is derived here so it can be tested exhaustively.
 * Authority never lives here; the Core RPCs and RLS remain the only enforcement.
 */

export const WORK_QUEUE_VIEWS = ["needs_action", "my_tasks", "waiting", "completed"] as const;
export type WorkQueueView = (typeof WORK_QUEUE_VIEWS)[number];

export const WORK_QUEUE_VIEW_LABELS: Record<WorkQueueView, string> = {
  needs_action: "Needs Action",
  my_tasks: "My Tasks",
  waiting: "Waiting",
  completed: "Completed",
};

export type WorkQueueUrgency = "overdue" | "due_soon" | "normal";
export type WorkQueueIdentity = "verified" | "unverified";

export type WorkQueueTaskRow = {
  id: string;
  case_id: string;
  department: string;
  assigned_user_id: string | null;
  task_type: string;
  instructions: string;
  status: string;
  due_at: string | null;
  created_at: string | null;
  completed_at: string | null;
  whatsapp_communication_cases: WorkQueueCaseRow | null;
};

export type WorkQueueCaseRow = {
  id: string;
  packet_id: string;
  company_id: string | null;
  case_type: string;
  status: string;
  accountable_team: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
};

export type WorkQueueContact = { packetId: string; customerName: string | null; phoneNumber: string | null };
export type WorkQueueStaff = { userId: string; displayName: string; department: string | null };

export type WorkQueueItem = {
  taskId: string;
  caseId: string;
  packetId: string;
  customerLabel: string;
  phoneNumber: string | null;
  identity: WorkQueueIdentity;
  summary: string;
  caseType: string;
  department: string;
  ownerUserId: string | null;
  ownerLabel: string;
  nextAction: string;
  dueAt: string | null;
  urgency: WorkQueueUrgency;
  taskStatus: string;
  view: WorkQueueView | null;
  completedAt: string | null;
  createdAt: string | null;
};

const DUE_SOON_MS = 4 * 60 * 60 * 1000;
const WAITING_CASE_STATUSES = new Set(["AWAITING_CUSTOMER", "NEEDS_CLARIFICATION"]);
const ACTIVE_TASK_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);
const CLOSED_CASE_STATUSES = new Set(["CLOSED", "CANCELLED"]);

export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function urgencyOf(dueAt: string | null, now: number): WorkQueueUrgency {
  if (!dueAt) return "normal";
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return "normal";
  if (due < now) return "overdue";
  if (due - now <= DUE_SOON_MS) return "due_soon";
  return "normal";
}

/** Which tab a task belongs to; null means it should not be listed at all. */
export function classifyView(
  task: Pick<WorkQueueTaskRow, "status" | "assigned_user_id">,
  caseRow: Pick<WorkQueueCaseRow, "status"> | null,
  meUserId: string | null,
): WorkQueueView | null {
  if (task.status === "COMPLETED") return "completed";
  if (task.status === "CANCELLED") return null;
  if (caseRow && CLOSED_CASE_STATUSES.has(caseRow.status)) return null;
  if (task.status === "BLOCKED") return "waiting";
  if (!ACTIVE_TASK_STATUSES.has(task.status)) return null;
  if (caseRow && WAITING_CASE_STATUSES.has(caseRow.status)) return "waiting";
  if (meUserId && task.assigned_user_id === meUserId) return "my_tasks";
  return "needs_action";
}

function oneLine(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function ownerLabelFor(
  ownerUserId: string | null,
  meUserId: string | null,
  staff: ReadonlyMap<string, WorkQueueStaff>,
): string {
  if (!ownerUserId) return "Unassigned";
  if (meUserId && ownerUserId === meUserId) return "You";
  return staff.get(ownerUserId)?.displayName ?? "Another colleague";
}

export function buildQueueItems(input: {
  tasks: readonly WorkQueueTaskRow[];
  contacts: readonly WorkQueueContact[];
  staff: readonly WorkQueueStaff[];
  meUserId: string | null;
  now: number;
}): WorkQueueItem[] {
  const contactByPacket = new Map(input.contacts.map((contact) => [contact.packetId, contact]));
  const staffById = new Map(input.staff.map((member) => [member.userId, member]));
  const items: WorkQueueItem[] = [];
  for (const task of input.tasks) {
    const caseRow = task.whatsapp_communication_cases;
    if (!caseRow) continue;
    const view = classifyView(task, caseRow, input.meUserId);
    if (!view) continue;
    const contact = contactByPacket.get(caseRow.packet_id);
    const phone = contact?.phoneNumber ?? null;
    const name = contact?.customerName?.trim() || null;
    const dueAt = task.due_at ?? caseRow.next_action_due_at;
    items.push({
      taskId: task.id,
      caseId: caseRow.id,
      packetId: caseRow.packet_id,
      customerLabel: name ?? (phone ? `+${phone.replace(/^\+/, "")}` : "Unknown sender"),
      phoneNumber: phone,
      identity: caseRow.company_id ? "verified" : "unverified",
      summary: oneLine(task.instructions || "", 180),
      caseType: caseRow.case_type,
      department: (task.department || caseRow.accountable_team || "").toUpperCase(),
      ownerUserId: task.assigned_user_id,
      ownerLabel: ownerLabelFor(task.assigned_user_id, input.meUserId, staffById),
      nextAction: oneLine(caseRow.next_action || humanize(task.task_type), 120),
      dueAt,
      urgency: view === "completed" ? "normal" : urgencyOf(dueAt, input.now),
      taskStatus: task.status,
      view,
      completedAt: task.completed_at,
      createdAt: task.created_at,
    });
  }
  return items;
}

export type WorkQueueFilters = {
  view: WorkQueueView;
  search: string;
  department: string;
  urgency: WorkQueueUrgency | "all";
  unverifiedOnly: boolean;
};

export const DEFAULT_WORK_QUEUE_FILTERS: WorkQueueFilters = {
  view: "needs_action",
  search: "",
  department: "all",
  urgency: "all",
  unverifiedOnly: false,
};

const URGENCY_RANK: Record<WorkQueueUrgency, number> = { overdue: 0, due_soon: 1, normal: 2 };

function ts(value: string | null): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function applyWorkQueueFilters(items: readonly WorkQueueItem[], filters: WorkQueueFilters): WorkQueueItem[] {
  const needle = filters.search.trim().toLowerCase();
  const selected = items.filter((item) => {
    if (item.view !== filters.view) return false;
    if (filters.department !== "all" && item.department !== filters.department) return false;
    if (filters.urgency !== "all" && item.urgency !== filters.urgency) return false;
    if (filters.unverifiedOnly && item.identity !== "unverified") return false;
    if (!needle) return true;
    const haystack = [
      item.customerLabel,
      item.phoneNumber ?? "",
      item.summary,
      item.nextAction,
      item.department,
      item.ownerLabel,
      humanize(item.caseType),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  if (filters.view === "completed") {
    return selected.sort((a, b) => ts(b.completedAt) - ts(a.completedAt));
  }
  // Most urgent first; unassigned work ahead of owned work; then oldest due date, then oldest created.
  return selected.sort((a, b) => {
    const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    const byOwner = Number(a.ownerUserId !== null) - Number(b.ownerUserId !== null);
    if (byOwner !== 0) return byOwner;
    const byDue = ts(a.dueAt) - ts(b.dueAt);
    if (byDue !== 0 && Number.isFinite(byDue)) return byDue;
    return ts(a.createdAt) - ts(b.createdAt);
  });
}

export function countByView(items: readonly WorkQueueItem[]): Record<WorkQueueView, number> {
  const counts: Record<WorkQueueView, number> = { needs_action: 0, my_tasks: 0, waiting: 0, completed: 0 };
  for (const item of items) if (item.view) counts[item.view] += 1;
  return counts;
}

export function departmentsIn(items: readonly WorkQueueItem[]): string[] {
  return [...new Set(items.map((item) => item.department).filter(Boolean))].sort();
}

export type WorkQueueActionKey = "claim" | "assign" | "release" | "complete" | "open";

/** Which buttons a card offers. UI hint only: Core RPCs re-check every permission. */
export function availableActions(
  item: Pick<WorkQueueItem, "view" | "ownerUserId">,
  meUserId: string | null,
  can: { triage: boolean; supervise: boolean },
): WorkQueueActionKey[] {
  const actions: WorkQueueActionKey[] = ["open"];
  if (item.view === "completed" || item.view === null) return actions;
  const mine = Boolean(meUserId) && item.ownerUserId === meUserId;
  if (!item.ownerUserId && can.triage) actions.push("claim");
  if (can.supervise) actions.push("assign");
  if (item.ownerUserId && (mine ? can.triage : can.supervise)) actions.push("release");
  if (mine && can.triage) actions.push("complete");
  return actions;
}

/** Taking a task from, or returning a task held by, somebody else is an override that needs a reason. */
export function needsOverrideReason(item: Pick<WorkQueueItem, "ownerUserId">, meUserId: string | null): boolean {
  return item.ownerUserId !== null && item.ownerUserId !== meUserId;
}

export function ownershipErrorMessage(raw: string): string {
  if (/ownership supervisor/i.test(raw)) return "Only supervisors can assign tasks or take them over from a colleague.";
  if (raw.includes("CASE_TASK_OVERRIDE_REASON_REQUIRED")) return "A reason is required to take a task from its current owner.";
  if (/could not find the function|PGRST202|function .+ does not exist/i.test(raw) && /whatsapp_(claim|assign|release)_case_task/i.test(raw)) {
    return "Task ownership is not available yet. Nothing was changed.";
  }
  if (raw.includes("CASE_TASK_ALREADY_CLAIMED")) return "A colleague claimed this task first. The list has been refreshed.";
  if (raw.includes("CASE_TASK_NOT_CLAIMABLE") || raw.includes("CASE_TASK_NOT_ASSIGNABLE") || raw.includes("CASE_TASK_NOT_RELEASABLE")) {
    return "This task is already finished or cancelled. The list has been refreshed.";
  }
  if (raw.includes("42501") || /permission required|only the task owner/i.test(raw)) return "You do not have permission for this action.";
  if (/assignee is not an active user/i.test(raw)) return "That person cannot take WhatsApp tasks.";
  return "The action could not be completed. Nothing was changed. Please try again.";
}
