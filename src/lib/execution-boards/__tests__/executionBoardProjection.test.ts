import { describe, expect, it } from "vitest";
import { DEPARTMENT_BOARDS } from "../departmentBoardConfig";
import { projectExecutionBoardLanes } from "../executionBoardProjection";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

function item(partial: Partial<MappedQueueItem> & { id: string }): MappedQueueItem {
  return {
    queueType: "production_queue",
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: null,
    customerId: null,
    title: "Test",
    summary: null,
    priority: "normal",
    state: "in_progress",
    ownerDepartment: "production",
    assignedTo: null,
    escalationLevel: "none",
    blockerCode: null,
    blockerSummary: null,
    slaDueAt: null,
    source: "execution_os",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-05-10T08:00:00.000Z",
    updatedAt: "2026-05-24T12:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    ...partial,
  };
}

describe("executionBoardProjection", () => {
  it("lanes blocked items separately", () => {
    const lanes = projectExecutionBoardLanes(
      [item({ id: "b1", state: "blocked", blockerCode: "x" })],
      DEPARTMENT_BOARDS.production,
      "2026-05-24T12:00:00.000Z",
      [],
    );
    expect(lanes.blocked).toHaveLength(1);
  });

  it("puts unowned in unowned lane", () => {
    const lanes = projectExecutionBoardLanes(
      [item({ id: "u1", assignedTo: null, state: "pending" })],
      DEPARTMENT_BOARDS.production,
      "2026-05-24T12:00:00.000Z",
      [],
    );
    expect(lanes.unowned).toHaveLength(1);
  });
});
