import type { ExecutionIntelligenceInput, ExecutionIntelligenceQueueItem } from "../executionIntelligenceTypes";

const NOW = "2026-05-24T12:00:00.000Z";
const OLD = "2026-05-20T08:00:00.000Z";

export function queueItem(partial: Partial<ExecutionIntelligenceQueueItem> & Pick<ExecutionIntelligenceQueueItem, "id">): ExecutionIntelligenceQueueItem {
  return {
    queueType: "production_queue",
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: "00000000-0000-4000-8000-000000000010",
    customerId: null,
    title: "Test queue item",
    state: "in_progress",
    ownerDepartment: "production",
    assignedTo: null,
    escalationLevel: "none",
    blockerCode: null,
    blockerSummary: null,
    slaDueAt: null,
    createdAt: OLD,
    updatedAt: NOW,
    ...partial,
  };
}

export function baseIntelligenceInput(overrides?: Partial<ExecutionIntelligenceInput>): ExecutionIntelligenceInput {
  return {
    nowIso: NOW,
    queueItems: [queueItem({ id: "q1" })],
    events: [],
    scans: [],
    ...overrides,
  };
}
