import { describe, expect, it } from "vitest";
import { mapOperationalEventToCustomerStatus } from "../customerTimelineEventMapper";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

function ev(
  type: OperationalStoreEventRecord["eventType"],
  extra?: Partial<OperationalStoreEventRecord>,
): OperationalStoreEventRecord {
  return {
    id: "e1",
    eventType: type,
    entityType: "order",
    entityId: "1",
    orderId: "o1",
    customerId: null,
    queueItemId: null,
    actorId: null,
    actorRole: null,
    actorDepartment: null,
    visibility: "internal",
    severity: "info",
    title: "Internal title must not leak",
    message: "Internal message must not leak",
    reasonCode: null,
    reasonText: null,
    metadata: { queueType: "production_queue" },
    correlationId: "c",
    idempotencyKey: null,
    createdAt: "2026-05-24T10:00:00.000Z",
    ...extra,
  };
}

describe("customerTimelineEventMapper", () => {
  it("maps queue_started to manufacturing for production queue", () => {
    const r = mapOperationalEventToCustomerStatus(ev("queue_started"));
    expect(r.status).toBe("manufacturing");
    expect(r.safeDetail).not.toContain("Internal");
  });

  it("does not map gate_scan_verified to dispatched", () => {
    const r = mapOperationalEventToCustomerStatus(ev("gate_scan_verified"));
    expect(r.status).toBe("packing");
    expect(r.status).not.toBe("dispatched");
  });

  it("suppresses scan_duplicate", () => {
    const r = mapOperationalEventToCustomerStatus(ev("scan_duplicate"));
    expect(r.suppressed).toBe(true);
  });

  it("public_candidate does not auto-publish unsafe content", () => {
    const r = mapOperationalEventToCustomerStatus(
      ev("queue_acknowledged", { visibility: "public_candidate", title: "Escalation panic CMD" }),
    );
    expect(r.suppressed).toBe(true);
  });
});
