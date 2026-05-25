import { describe, expect, it } from "vitest";
import { isEventSuppressedForCustomer, textContainsSuppressedTerm } from "../customerTimelineSuppression";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

function ev(partial: Partial<OperationalStoreEventRecord> & Pick<OperationalStoreEventRecord, "eventType">): OperationalStoreEventRecord {
  return {
    id: "e1",
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: "00000000-0000-4000-8000-000000000010",
    customerId: null,
    queueItemId: null,
    actorId: null,
    actorRole: "OPERATIONS_MANAGER",
    actorDepartment: "finance",
    visibility: "internal",
    severity: "info",
    title: "Update",
    message: null,
    reasonCode: null,
    reasonText: null,
    metadata: {},
    correlationId: "c1",
    idempotencyKey: null,
    createdAt: "2026-05-24T12:00:00.000Z",
    ...partial,
  };
}

describe("customerTimelineSuppression", () => {
  it("suppresses finance hold in title", () => {
    expect(
      isEventSuppressedForCustomer(ev({ eventType: "queue_acknowledged", title: "Finance hold on order" })),
    ).toBe(true);
  });

  it("suppresses mismatch scan events", () => {
    expect(isEventSuppressedForCustomer(ev({ eventType: "scan_mismatch" }))).toBe(true);
  });

  it("suppresses actor department metadata", () => {
    expect(textContainsSuppressedTerm("dispatch department conflict")).toBe(true);
  });

  it("does not pass raw internal title through when blocked", () => {
    const e = ev({ eventType: "queue_blocked", title: "Blocked: material shortage" });
    expect(isEventSuppressedForCustomer(e)).toBe(true);
  });
});
