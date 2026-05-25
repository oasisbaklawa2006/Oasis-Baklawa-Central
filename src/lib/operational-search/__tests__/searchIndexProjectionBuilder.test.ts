import { describe, expect, it } from "vitest";
import {
  projectOperationalEventSearchEntry,
  projectOrderSearchEntry,
  projectScanRecordSearchEntry,
} from "../searchIndexProjectionBuilder";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

describe("searchIndexProjectionBuilder", () => {
  it("projects order with SO tokens", () => {
    const p = projectOrderSearchEntry({
      id: "00000000-0000-4000-8000-000000000099",
      orderNumber: "SO-2026-000099",
      status: "confirmed",
    });
    expect(p.soNumbers).toContain("SO-2026-000099");
    expect(p.visibility).toBe("customer_safe_candidate");
  });

  it("does not expose raw unsafe event title in customer_safe_candidate", () => {
    const ev: OperationalStoreEventRecord = {
      id: "e1",
      eventType: "queue_escalated",
      entityType: "order",
      entityId: "o1",
      orderId: "o1",
      customerId: null,
      queueItemId: null,
      actorId: null,
      actorRole: null,
      actorDepartment: null,
      visibility: "internal",
      severity: "urgent",
      title: "Escalation finance hold panic",
      message: "blocker",
      reasonCode: null,
      reasonText: null,
      metadata: {},
      correlationId: "c",
      idempotencyKey: null,
      createdAt: "2026-05-24T10:00:00.000Z",
    };
    const p = projectOperationalEventSearchEntry(ev);
    expect(p.visibility).not.toBe("customer_safe_candidate");
    expect(p.searchBody).toBeNull();
  });

  it("restricts mismatch scan indexing", () => {
    const p = projectScanRecordSearchEntry({
      id: "s1",
      barcodeValue: "BC-1",
      verificationStatus: "mismatch",
      scanType: "carton",
    });
    expect(p.sensitivity).toBe("restricted");
    expect(p.searchBody).toBeNull();
  });
});
