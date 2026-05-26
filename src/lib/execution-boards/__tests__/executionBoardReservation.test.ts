import { describe, expect, it } from "vitest";
import { getDepartmentBoard } from "../departmentBoardConfig";
import { projectExecutionBoardLanes } from "../executionBoardProjection";
import type { MappedQueueItem } from "@/lib/persistent-queues/queueRowMapper";

function item(partial: Partial<MappedQueueItem>): MappedQueueItem {
  return {
    id: "q1",
    queueType: "inventory_verification_queue",
    entityType: "order",
    entityId: "e1",
    orderId: "o1",
    customerId: null,
    title: "Ready goods check",
    summary: null,
    priority: "normal",
    state: "in_progress",
    ownerDepartment: "inventory",
    assignedTo: "u1",
    escalationLevel: "none",
    blockerCode: null,
    blockerSummary: null,
    slaDueAt: null,
    source: "test",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z",
    completedAt: null,
    cancelledAt: null,
    ...partial,
  };
}

describe("executionBoardReservation", () => {
  it("projects reservation indicator on ready-goods board", () => {
    const config = getDepartmentBoard("ready-goods");
    const lanes = projectExecutionBoardLanes(
      [item({})],
      config,
      "2026-05-24T12:00:00.000Z",
      [],
      [
        {
          id: "r1",
          reservationNumber: "RES-1",
          orderId: "o1",
          queueItemId: null,
          customerId: null,
          productId: "p1",
          sku: "SKU",
          requestedQty: 10,
          reservedQty: 10,
          fulfilledQty: 0,
          releasedQty: 0,
          reservationStatus: "reserved",
          reservationPriority: "normal",
          sourceDepartment: null,
          reservedBy: null,
          approvedBy: null,
          expiresAt: null,
          notes: null,
          correlationId: "c",
          version: 1,
          createdAt: "2026-05-24T10:00:00.000Z",
          updatedAt: "2026-05-24T10:00:00.000Z",
        },
      ],
    );
    const card = lanes.queue[0] ?? lanes.aging[0] ?? lanes.unowned[0];
    expect(card?.reservationIndicator).toBe("reserved");
  });
});
