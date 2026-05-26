import { describe, expect, it } from "vitest";
import { assertPublicContractSafe, toCustomerTimelinePublicContract } from "../customerTimelineContract";
import { projectCustomerTimelineFromEvents } from "../customerTimelineProjection";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

function ev(
  type: OperationalStoreEventRecord["eventType"],
  at: string,
  meta?: Record<string, unknown>,
): OperationalStoreEventRecord {
  return {
    id: crypto.randomUUID(),
    eventType: type,
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: "00000000-0000-4000-8000-000000000099",
    customerId: null,
    queueItemId: null,
    actorId: null,
    actorRole: null,
    actorDepartment: null,
    visibility: "internal",
    severity: "info",
    title: "DO NOT SHOW",
    message: "DO NOT SHOW",
    reasonCode: null,
    reasonText: null,
    metadata: { queueType: "production_queue", ...meta },
    correlationId: "c",
    idempotencyKey: null,
    createdAt: at,
  };
}

describe("customerTimelineProjection", () => {
  it("projects deterministic timeline from events", () => {
    const a = projectCustomerTimelineFromEvents({
      orderId: "order-1",
      events: [
        ev("queue_acknowledged", "2026-05-24T08:00:00.000Z"),
        ev("queue_started", "2026-05-24T09:00:00.000Z"),
      ],
      nowIso: "2026-05-24T12:00:00.000Z",
    });
    const b = projectCustomerTimelineFromEvents({
      orderId: "order-1",
      events: [
        ev("queue_acknowledged", "2026-05-24T08:00:00.000Z"),
        ev("queue_started", "2026-05-24T09:00:00.000Z"),
      ],
      nowIso: "2026-05-24T12:00:00.000Z",
    });
    expect(a.currentStatus).toBe(b.currentStatus);
    expect(a.safeDetail).not.toMatch(/DO NOT SHOW/i);
  });

  it("counts suppressed events", () => {
    const p = projectCustomerTimelineFromEvents({
      orderId: "order-2",
      events: [ev("queue_blocked", "2026-05-24T08:00:00.000Z"), ev("queue_acknowledged", "2026-05-24T09:00:00.000Z")],
    });
    expect(p.suppressedEventCount).toBeGreaterThan(0);
  });

  it("public contract excludes internal ids", () => {
    const p = projectCustomerTimelineFromEvents({
      orderId: "00000000-0000-4000-8000-000000000099",
      events: [ev("queue_acknowledged", "2026-05-24T08:00:00.000Z")],
    });
    const contract = toCustomerTimelinePublicContract(p, "SO-1001");
    assertPublicContractSafe(contract);
    expect(contract.publicOrderRef).toBe("SO-1001");
  });
});
