import { describe, expect, it } from "vitest";
import {
  Point74OrderControlError,
  buildPoint74QueueSortInput,
  projectPoint74OrderControlFacts,
  requireOrderControlId,
} from "@/lib/point74OrderControl";
import type { OrderPriorityOwnerSlaRawFacts } from "@/lib/order-priority-owner-sla";

const raw: OrderPriorityOwnerSlaRawFacts = {
  orderId: "order-1",
  orderNumber: "SO-1",
  status: "submitted",
  createdAt: "2026-09-01T00:00:00Z",
  dispatchUrgency: "panic",
  requestedDispatchDate: "2026-09-10",
  adminPromisedDate: null,
  estimatedDespatchDate: null,
  systemEstimatedDate: null,
  commercialPromisedDispatchDate: null,
  commercialRequestedDispatchDate: null,
  wamid: null,
  draftOrderHandlerId: null,
  draftOrderHandlerName: null,
  draftClientOwnerId: null,
  draftClientOwnerName: null,
  accountManagerId: null,
};

describe("point74OrderControl", () => {
  it("fail-closes undefined order ids", () => {
    expect(() => requireOrderControlId(undefined)).toThrow(Point74OrderControlError);
    expect(() => requireOrderControlId("   ")).toThrow(Point74OrderControlError);
  });

  it("projects priority/owner/SLA facts with a required anchor", () => {
    const facts = projectPoint74OrderControlFacts(raw, "2026-09-07T12:00:00Z");
    expect(facts.orderId).toBe("order-1");
    expect(facts.priority.band).toBe("panic");
    expect(facts.fetchedAt).toBe("2026-09-07T12:00:00Z");
  });

  it("builds queue sort inputs with required order ids", () => {
    const input = buildPoint74QueueSortInput({
      orderId: "order-1",
      createdAt: raw.createdAt,
      raw,
      nowIso: "2026-09-07T12:00:00Z",
    });
    expect(input.orderId).toBe("order-1");
    expect(input.facts.priority.band).toBe("panic");
  });
});
