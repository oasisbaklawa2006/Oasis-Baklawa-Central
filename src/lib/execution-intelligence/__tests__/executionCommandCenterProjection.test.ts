import { describe, expect, it } from "vitest";
import { buildExecutionCommandCenterProjection } from "../executionCommandCenterProjection";
import { aggregateOperationalEventStream } from "../operationalEventAggregation";
import { baseIntelligenceInput } from "./fixtures";

describe("executionCommandCenterProjection", () => {
  it("builds full projection snapshot", () => {
    const p = buildExecutionCommandCenterProjection(baseIntelligenceInput());
    expect(p.globalQueuePressure.open).toBeGreaterThan(0);
    expect(p.slaBreaches.length).toBeGreaterThan(0);
    expect(p.executionConfidence).toBeGreaterThanOrEqual(0);
  });

  it("suppresses customer-unsafe event titles in stream", () => {
    const stream = aggregateOperationalEventStream(
      baseIntelligenceInput({
        events: [
          {
            id: "e1",
            eventType: "queue_blocked",
            entityType: "order",
            entityId: "00000000-0000-4000-8000-000000000001",
            orderId: null,
            customerId: null,
            queueItemId: null,
            actorId: null,
            actorRole: null,
            actorDepartment: null,
            visibility: "internal",
            severity: "warning",
            title: "Finance hold on order",
            message: null,
            reasonCode: null,
            reasonText: null,
            metadata: {},
            correlationId: "c1",
            idempotencyKey: null,
            createdAt: "2026-05-24T12:00:00.000Z",
          },
        ],
      }),
    );
    expect(stream[0]?.staffOnly).toBe(true);
    expect(stream[0]?.title).toBe("[Staff] Operational update");
  });
});
