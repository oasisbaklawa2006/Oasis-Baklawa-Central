import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_QUEUE_FILTERS,
  applyWorkQueueFilters,
  availableActions,
  buildQueueItems,
  classifyView,
  countByView,
  ownershipErrorMessage,
  urgencyOf,
  type WorkQueueTaskRow,
} from "./workQueueModel";

const NOW = Date.parse("2026-10-25T10:00:00Z");
const ME = "user-me";
const OTHER = "user-other";
const HOUR = 3_600_000;

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

function task(over: Partial<WorkQueueTaskRow> & { id: string }, caseOver: Record<string, unknown> = {}): WorkQueueTaskRow {
  return {
    case_id: `case-${over.id}`,
    department: "CUSTOMER_SERVICE",
    assigned_user_id: null,
    task_type: "ACCOUNTABLE_RESPONSE_OWNER",
    instructions: "Confirm the 75 box enquiry with the customer",
    status: "OPEN",
    due_at: iso(8 * HOUR),
    created_at: iso(-HOUR),
    completed_at: null,
    whatsapp_communication_cases: {
      id: `case-${over.id}`,
      packet_id: `packet-${over.id}`,
      company_id: null,
      case_type: "ENQUIRY",
      status: "OPEN",
      accountable_team: "CUSTOMER_SERVICE",
      next_action: null,
      next_action_due_at: null,
      ...caseOver,
    },
    ...over,
  } as WorkQueueTaskRow;
}

const contacts = [
  { packetId: "packet-t1", customerName: "Asha Traders", phoneNumber: "919830000001" },
  { packetId: "packet-t2", customerName: null, phoneNumber: "919830000002" },
];
const staff = [{ userId: OTHER, displayName: "Ravi Kumar", department: "Customer Service" }];

describe("classifyView", () => {
  it("routes tasks to exactly one tab", () => {
    expect(classifyView({ status: "OPEN", assigned_user_id: null }, { status: "OPEN" }, ME)).toBe("needs_action");
    expect(classifyView({ status: "IN_PROGRESS", assigned_user_id: ME }, { status: "OPEN" }, ME)).toBe("my_tasks");
    expect(classifyView({ status: "IN_PROGRESS", assigned_user_id: OTHER }, { status: "OPEN" }, ME)).toBe("needs_action");
    expect(classifyView({ status: "BLOCKED", assigned_user_id: ME }, { status: "OPEN" }, ME)).toBe("waiting");
    expect(classifyView({ status: "OPEN", assigned_user_id: null }, { status: "AWAITING_CUSTOMER" }, ME)).toBe("waiting");
    expect(classifyView({ status: "OPEN", assigned_user_id: null }, { status: "NEEDS_CLARIFICATION" }, ME)).toBe("waiting");
    expect(classifyView({ status: "COMPLETED", assigned_user_id: ME }, { status: "CLOSED" }, ME)).toBe("completed");
  });

  it("lists nothing for cancelled tasks or tasks on closed cases", () => {
    expect(classifyView({ status: "CANCELLED", assigned_user_id: null }, { status: "OPEN" }, ME)).toBeNull();
    expect(classifyView({ status: "OPEN", assigned_user_id: null }, { status: "CLOSED" }, ME)).toBeNull();
    expect(classifyView({ status: "OPEN", assigned_user_id: null }, { status: "CANCELLED" }, ME)).toBeNull();
  });

  it("never treats a task as mine when the viewer is unknown", () => {
    expect(classifyView({ status: "OPEN", assigned_user_id: ME }, { status: "OPEN" }, null)).toBe("needs_action");
  });
});

describe("urgencyOf", () => {
  it("separates overdue, due soon and on track", () => {
    expect(urgencyOf(iso(-1), NOW)).toBe("overdue");
    expect(urgencyOf(iso(2 * HOUR), NOW)).toBe("due_soon");
    expect(urgencyOf(iso(5 * HOUR), NOW)).toBe("normal");
    expect(urgencyOf(null, NOW)).toBe("normal");
    expect(urgencyOf("not-a-date", NOW)).toBe("normal");
  });
});

describe("buildQueueItems", () => {
  const rows = [
    task({ id: "t1", assigned_user_id: OTHER, due_at: iso(-HOUR) }, { company_id: "company-1" }),
    task({ id: "t2" }),
    task({ id: "t3", status: "CANCELLED" }),
    task({ id: "t4", status: "COMPLETED", completed_at: iso(-2 * HOUR) }),
  ];
  const items = buildQueueItems({ tasks: rows, contacts, staff, meUserId: ME, now: NOW });

  it("drops unlisted tasks and keeps the rest", () => {
    expect(items.map((item) => item.taskId).sort()).toEqual(["t1", "t2", "t4"]);
    expect(countByView(items)).toEqual({ needs_action: 2, my_tasks: 0, waiting: 0, completed: 1 });
  });

  it("derives identity status, owner and customer label without exposing raw ids", () => {
    const t1 = items.find((item) => item.taskId === "t1")!;
    expect(t1.identity).toBe("verified");
    expect(t1.ownerLabel).toBe("Ravi Kumar");
    expect(t1.customerLabel).toBe("Asha Traders");
    expect(t1.urgency).toBe("overdue");
    const t2 = items.find((item) => item.taskId === "t2")!;
    expect(t2.identity).toBe("unverified");
    expect(t2.ownerLabel).toBe("Unassigned");
    expect(t2.customerLabel).toBe("+919830000002");
    expect(JSON.stringify(items.map((item) => item.ownerLabel))).not.toContain(OTHER);
  });

  it("labels unknown colleagues generically and the viewer as You", () => {
    const mine = buildQueueItems({ tasks: [task({ id: "t1", assigned_user_id: ME })], contacts, staff: [], meUserId: ME, now: NOW });
    expect(mine[0].ownerLabel).toBe("You");
    const stranger = buildQueueItems({ tasks: [task({ id: "t1", assigned_user_id: "someone-else" })], contacts, staff: [], meUserId: ME, now: NOW });
    expect(stranger[0].ownerLabel).toBe("Another colleague");
  });

  it("falls back to the case next action, then the task type", () => {
    const withAction = buildQueueItems({
      tasks: [task({ id: "t1" }, { next_action: "Call the buyer about the 75 box quantity" })],
      contacts, staff, meUserId: ME, now: NOW,
    });
    expect(withAction[0].nextAction).toBe("Call the buyer about the 75 box quantity");
    expect(items.find((item) => item.taskId === "t2")!.nextAction).toBe("Accountable Response Owner");
  });

  it("truncates long summaries to one line", () => {
    const long = buildQueueItems({
      tasks: [task({ id: "t1", instructions: `line one\n${"x".repeat(400)}` })],
      contacts, staff, meUserId: ME, now: NOW,
    });
    expect(long[0].summary.length).toBeLessThanOrEqual(180);
    expect(long[0].summary).not.toContain("\n");
  });
});

describe("applyWorkQueueFilters", () => {
  const rows = [
    task({ id: "t1", due_at: iso(-HOUR) }, { company_id: "c1" }),
    task({ id: "t2", due_at: iso(2 * HOUR), department: "SALES" }),
    task({ id: "t5", due_at: iso(-3 * HOUR), assigned_user_id: OTHER }),
    task({ id: "t6", due_at: iso(-3 * HOUR) }),
    task({ id: "t7", assigned_user_id: ME, status: "IN_PROGRESS" }),
  ];
  const items = buildQueueItems({
    tasks: rows,
    contacts: [...contacts, { packetId: "packet-t5", customerName: "Zed", phoneNumber: "91983" }],
    staff, meUserId: ME, now: NOW,
  });

  it("defaults to Needs Action, most urgent and unassigned first", () => {
    const list = applyWorkQueueFilters(items, DEFAULT_WORK_QUEUE_FILTERS);
    // Overdue first; within the same urgency, unassigned (claimable) work ahead of owned work, then oldest due.
    expect(list.map((item) => item.taskId)).toEqual(["t6", "t1", "t5", "t2"]);
  });

  it("filters by tab, department, urgency, identity and search", () => {
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, view: "my_tasks" }).map((item) => item.taskId)).toEqual(["t7"]);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, department: "SALES" }).map((item) => item.taskId)).toEqual(["t2"]);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, urgency: "overdue" })).toHaveLength(3);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, unverifiedOnly: true }).every((item) => item.identity === "unverified")).toBe(true);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, search: "asha" }).map((item) => item.taskId)).toEqual(["t1"]);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, search: "ravi" }).map((item) => item.taskId)).toEqual(["t5"]);
    expect(applyWorkQueueFilters(items, { ...DEFAULT_WORK_QUEUE_FILTERS, search: "nothing matches this" })).toEqual([]);
  });

  it("orders Completed by most recent completion", () => {
    const done = buildQueueItems({
      tasks: [
        task({ id: "t1", status: "COMPLETED", completed_at: iso(-5 * HOUR) }),
        task({ id: "t2", status: "COMPLETED", completed_at: iso(-HOUR) }),
      ],
      contacts, staff, meUserId: ME, now: NOW,
    });
    expect(applyWorkQueueFilters(done, { ...DEFAULT_WORK_QUEUE_FILTERS, view: "completed" }).map((item) => item.taskId)).toEqual(["t2", "t1"]);
  });
});

describe("availableActions (UI hint; Core re-checks every permission)", () => {
  const noPerms = { triage: false, assign: false };
  it("offers Claim only on unassigned active tasks and only to triage staff", () => {
    expect(availableActions({ view: "needs_action", ownerUserId: null }, ME, { triage: true, assign: false })).toEqual(["open", "claim"]);
    expect(availableActions({ view: "needs_action", ownerUserId: null }, ME, noPerms)).toEqual(["open"]);
    expect(availableActions({ view: "needs_action", ownerUserId: OTHER }, ME, { triage: true, assign: false })).toEqual(["open"]);
  });

  it("lets owners complete and return, and managers assign or release others' tasks", () => {
    expect(availableActions({ view: "my_tasks", ownerUserId: ME }, ME, { triage: true, assign: false })).toEqual(["open", "release", "complete"]);
    expect(availableActions({ view: "needs_action", ownerUserId: OTHER }, ME, { triage: true, assign: true })).toEqual(["open", "assign", "release"]);
    expect(availableActions({ view: "needs_action", ownerUserId: null }, ME, { triage: false, assign: true })).toEqual(["open", "assign"]);
  });

  it("offers only Review on completed work", () => {
    expect(availableActions({ view: "completed", ownerUserId: ME }, ME, { triage: true, assign: true })).toEqual(["open"]);
  });
});

describe("ownershipErrorMessage", () => {
  it("maps Core errors to plain language and hides internals", () => {
    expect(ownershipErrorMessage("CASE_TASK_ALREADY_CLAIMED")).toMatch(/colleague claimed/);
    expect(ownershipErrorMessage("CASE_TASK_NOT_CLAIMABLE: task is completed")).toMatch(/finished or cancelled/);
    expect(ownershipErrorMessage("WhatsApp assignment permission required")).toMatch(/permission/);
    expect(ownershipErrorMessage("assignee is not an active user with WhatsApp triage permission")).toMatch(/cannot take/);
    expect(ownershipErrorMessage("relation \"x\" does not exist")).toBe("The action could not be completed. Nothing was changed. Please try again.");
  });
});
