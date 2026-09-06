import { describe, expect, it } from "vitest";
import {
  buildCompleteWorkItemUpdatePayload,
  buildCreateWorkItemInsertPayload,
  buildSnoozeWorkItemUpdatePayload,
  CrmWorkItemContractError,
  rejectFabricatedCommercialFacts,
  validateCreateWorkItemInput,
} from "../crmWorkItemsContract";

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("crmWorkItemsContract", () => {
  it("fails closed on missing company", () => {
    expect(() =>
      validateCreateWorkItemInput({
        companyId: "",
        ownerExecutiveId: "exec-1",
        kind: "follow_up",
        dueDate: "2026-04-01",
      }),
    ).toThrow(CrmWorkItemContractError);
  });

  it("fails closed on missing owner", () => {
    expect(() =>
      validateCreateWorkItemInput({
        companyId: COMPANY_ID,
        ownerExecutiveId: "",
        kind: "follow_up",
        dueDate: "2026-04-01",
      }),
    ).toThrow(/Owner/);
  });

  it("rejects fabricated opportunity commercial facts", () => {
    expect(() =>
      rejectFabricatedCommercialFacts({ opportunityValue: 50000, probability: 0.8 }),
    ).toThrow(/fabricated_commercial_facts|not governed/i);
  });

  it("creates insert payload with created audit event", () => {
    const payload = buildCreateWorkItemInsertPayload({
      companyId: COMPANY_ID,
      ownerExecutiveId: "exec-1",
      kind: "follow_up",
      dueDate: "2026-04-01",
      description: "Quarterly check-in",
    });
    expect(payload.company_id).toBe(COMPANY_ID.toLowerCase());
    expect(payload.sales_exec_id).toBe("exec-1");
    expect(payload.status).toBe("pending");
    expect(payload.description).toContain("crm_work_item_audit");
    expect(payload.description).toContain('"action":"created"');
  });

  it("completes only pending tasks", () => {
    expect(() =>
      buildCompleteWorkItemUpdatePayload({
        task: {
          id: "t1",
          company_id: COMPANY_ID,
          sales_exec_id: "exec-1",
          task_type: "follow_up",
          status: "completed",
          due_date: "2026-04-01",
          description: null,
          completed_at: "2026-04-02T00:00:00.000Z",
          created_at: null,
        },
        actorExecutiveId: "exec-1",
      }),
    ).toThrow(/invalid_status_transition|Completed/);
  });

  it("snooze preserves prior due date in audit trail", () => {
    const payload = buildSnoozeWorkItemUpdatePayload({
      task: {
        id: "t2",
        company_id: COMPANY_ID,
        sales_exec_id: "exec-1",
        task_type: "follow_up",
        status: "pending",
        due_date: "2026-04-01",
        description: "Call client",
        completed_at: null,
        created_at: null,
      },
      newDueDate: "2026-04-15",
      actorExecutiveId: "exec-1",
      reason: "On leave",
    });
    expect(payload.due_date).toBe("2026-04-15");
    expect(payload.description).toContain('"fromDueDate":"2026-04-01"');
    expect(payload.description).toContain('"toDueDate":"2026-04-15"');
    expect(payload.description).toContain("Call client");
  });

  it("blocks snooze on completed tasks", () => {
    expect(() =>
      buildSnoozeWorkItemUpdatePayload({
        task: {
          id: "t3",
          company_id: COMPANY_ID,
          sales_exec_id: "exec-1",
          task_type: "follow_up",
          status: "completed",
          due_date: "2026-04-01",
          description: null,
          completed_at: "2026-04-02T00:00:00.000Z",
          created_at: null,
        },
        newDueDate: "2026-04-15",
        actorExecutiveId: "exec-1",
      }),
    ).toThrow(/snooze_not_open|open/);
  });

  it("blocks backward snooze dates", () => {
    expect(() =>
      buildSnoozeWorkItemUpdatePayload({
        task: {
          id: "t4",
          company_id: COMPANY_ID,
          sales_exec_id: "exec-1",
          task_type: "follow_up",
          status: "pending",
          due_date: "2026-04-15",
          description: null,
          completed_at: null,
          created_at: null,
        },
        newDueDate: "2026-04-01",
        actorExecutiveId: "exec-1",
      }),
    ).toThrow(/backward|earlier/i);
  });
});
