import { describe, expect, it } from "vitest";
import {
  appendWorkItemAuditTrail,
  buildCrmWorkItemKindGovernance,
  buildWorkItemsReadModelFromRows,
  isOverdue,
  normalizeCrmTaskRow,
  normalizeFollowUpCommitmentRow,
  parseWorkItemAuditTrail,
} from "../crmWorkItemsNormalizer";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const OTHER_COMPANY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REF_DATE = "2026-03-15";

describe("crmWorkItemsNormalizer", () => {
  it("drops tasks with mismatched company_id", () => {
    const entry = normalizeCrmTaskRow(
      {
        id: "task-1",
        company_id: OTHER_COMPANY,
        sales_exec_id: "exec-1",
        task_type: "follow_up",
        status: "pending",
        due_date: "2026-03-20",
        description: "Call back",
        completed_at: null,
        created_at: "2026-03-01T00:00:00.000Z",
      },
      COMPANY_ID,
      REF_DATE,
    );
    expect(entry).toBeNull();
  });

  it("drops tasks without owner executive", () => {
    const entry = normalizeCrmTaskRow(
      {
        id: "task-2",
        company_id: COMPANY_ID,
        sales_exec_id: null,
        task_type: "follow_up",
        status: "pending",
        due_date: "2026-03-20",
        description: null,
        completed_at: null,
        created_at: null,
      },
      COMPANY_ID,
      REF_DATE,
    );
    expect(entry).toBeNull();
  });

  it("marks overdue pending tasks", () => {
    const entry = normalizeCrmTaskRow(
      {
        id: "task-3",
        company_id: COMPANY_ID,
        sales_exec_id: "exec-1",
        task_type: "follow_up",
        status: "pending",
        due_date: "2026-03-01",
        description: null,
        completed_at: null,
        created_at: null,
      },
      COMPANY_ID,
      REF_DATE,
    );
    expect(entry?.isOverdue).toBe(true);
    expect(entry?.displayStatus).toBe("overdue");
  });

  it("parses and preserves snooze audit trail without erasing prior due state", () => {
    const withAudit = appendWorkItemAuditTrail("Initial note", [
      {
        action: "snooze",
        fromDueDate: "2026-03-01",
        toDueDate: "2026-03-20",
        at: "2026-03-02T10:00:00.000Z",
        byExecutiveId: "exec-1",
        reason: "Client travelling",
      },
    ]);
    const parsed = parseWorkItemAuditTrail(withAudit);
    expect(parsed.userDescription).toBe("Initial note");
    expect(parsed.audit).toHaveLength(1);
    expect(parsed.audit[0]?.fromDueDate).toBe("2026-03-01");
    expect(parsed.audit[0]?.toDueDate).toBe("2026-03-20");
  });

  it("projects follow-up commitments separately from crm_tasks", () => {
    const commitment = normalizeFollowUpCommitmentRow(
      {
        id: "ci-1",
        company_id: COMPANY_ID,
        executive_id: "exec-1",
        interaction_type: "call",
        notes: "Check pricing",
        follow_up_date: "2026-03-10",
        created_at: "2026-03-01T00:00:00.000Z",
      },
      COMPANY_ID,
      REF_DATE,
      new Set(),
    );
    expect(commitment?.kind).toBe("follow_up_commitment");
    expect(commitment?.source.authority).toBe("client_interactions");
    expect(isOverdue("2026-03-10", REF_DATE)).toBe(true);
  });

  it("splits open vs history lanes deterministically", () => {
    const model = buildWorkItemsReadModelFromRows(
      COMPANY_ID,
      [
        {
          id: "open-1",
          company_id: COMPANY_ID,
          sales_exec_id: "exec-1",
          task_type: "follow_up",
          status: "pending",
          due_date: "2026-03-20",
          description: null,
          completed_at: null,
          created_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "done-1",
          company_id: COMPANY_ID,
          sales_exec_id: "exec-1",
          task_type: "sample",
          status: "completed",
          due_date: "2026-02-01",
          description: null,
          completed_at: "2026-02-05T00:00:00.000Z",
          created_at: "2026-01-20T00:00:00.000Z",
        },
      ],
      [],
      REF_DATE,
    );
    expect(model.openItems).toHaveLength(1);
    expect(model.historyItems).toHaveLength(1);
    expect(model.openItems[0]?.itemId).toBe("task:open-1");
  });

  it("documents opportunity kind as partial without commercial facts", () => {
    const opportunity = buildCrmWorkItemKindGovernance().find((k) => k.kind === "opportunity");
    expect(opportunity?.availability).toBe("partial");
    expect(opportunity?.reason).toMatch(/value|probability/i);
  });
});
