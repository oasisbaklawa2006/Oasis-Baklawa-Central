import { describe, expect, it } from "vitest";
import {
  compareOrderPoolQueueItems,
  isDispatchPanicFromUrgency,
  normalizePriorityBand,
  projectOrderPriorityOwnerSlaFacts,
  priorityRankForBand,
  resolveSlaDueDate,
} from "../orderPriorityOwnerSlaProjection";
import type { OrderPriorityOwnerSlaRawFacts } from "../orderPriorityOwnerSlaTypes";

const baseRaw = (overrides: Partial<OrderPriorityOwnerSlaRawFacts> = {}): OrderPriorityOwnerSlaRawFacts => ({
  orderId: "order-1",
  dispatchUrgency: "standard",
  createdAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("Point74 order priority / owner / SLA projection", () => {
  it("derives priority band deterministically from orders.dispatch_urgency", () => {
    expect(normalizePriorityBand("panic")).toBe("panic");
    expect(normalizePriorityBand("standard")).toBe("standard");
    expect(normalizePriorityBand("weird")).toBe("unknown");
    expect(priorityRankForBand("panic")).toBeLessThan(priorityRankForBand("standard"));
  });

  it("prefers commercial promised dispatch over admin promised date (Point73 authority)", () => {
    const resolved = resolveSlaDueDate(
      baseRaw({
        commercialPromisedDispatchDate: "2026-09-12",
        adminPromisedDate: "2026-09-10",
        requestedDispatchDate: "2026-09-08",
      }),
    );
    expect(resolved.provenance).toBe("core_commercial_facts_promised_dispatch");
    expect(resolved.dueDate).toBe("2026-09-12");
  });

  it("falls back through admin → estimated → system → requested dispatch dates", () => {
    expect(resolveSlaDueDate(baseRaw({ adminPromisedDate: "2026-09-11" })).provenance).toBe(
      "orders_admin_promised",
    );
    expect(resolveSlaDueDate(baseRaw({ estimatedDespatchDate: "2026-09-09" })).provenance).toBe(
      "orders_estimated_despatch",
    );
    expect(resolveSlaDueDate(baseRaw({ systemEstimatedDate: "2026-09-07" })).provenance).toBe(
      "orders_system_estimated",
    );
    expect(resolveSlaDueDate(baseRaw({ requestedDispatchDate: "2026-09-05" })).provenance).toBe(
      "orders_requested_dispatch",
    );
  });

  it("marks SLA overdue when now is past canonical due date", () => {
    const facts = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ adminPromisedDate: "2026-09-01" }),
      "2026-09-06T12:00:00.000Z",
      "2026-09-06T12:00:00.000Z",
    );
    expect(facts.sla.overdue).toBe(true);
    expect(facts.sla.daysUntilDue).toBeLessThan(0);
  });

  it("resolves owner from draft handler before client owner before account manager", () => {
    const handlerFirst = projectOrderPriorityOwnerSlaFacts(
      baseRaw({
        draftOrderHandlerId: "handler-1",
        draftClientOwnerId: "owner-1",
        accountManagerId: "mgr-1",
      }),
      "2026-09-06T12:00:00.000Z",
    );
    expect(handlerFirst.owner.slot).toBe("order_handler");
    expect(handlerFirst.owner.provenance).toBe("sales_order_draft");

    const clientOwner = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ draftClientOwnerId: "owner-1", accountManagerId: "mgr-1" }),
      "2026-09-06T12:00:00.000Z",
    );
    expect(clientOwner.owner.slot).toBe("client_owner");

    const accountManager = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ accountManagerId: "mgr-1" }),
      "2026-09-06T12:00:00.000Z",
    );
    expect(accountManager.owner.slot).toBe("account_manager");
    expect(accountManager.owner.provenance).toBe("companies_account_manager");
  });

  it("attributes WhatsApp source from orders.wamid (Point72 preserved)", () => {
    const facts = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ wamid: "wamid.abc" }),
      "2026-09-06T12:00:00.000Z",
    );
    expect(facts.source.channel).toBe("whatsapp");
    expect(facts.source.provenance).toBe("orders_wamid");
  });

  it("sorts pool queue items: complaint > panic > overdue SLA > due date > created_at", () => {
    const now = "2026-09-06T12:00:00.000Z";
    const panic = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ orderId: "panic", dispatchUrgency: "panic", createdAt: "2026-09-05T00:00:00.000Z" }),
      now,
      now,
    );
    const overdue = projectOrderPriorityOwnerSlaFacts(
      baseRaw({
        orderId: "overdue",
        adminPromisedDate: "2026-09-01",
        createdAt: "2026-09-04T00:00:00.000Z",
      }),
      now,
      now,
    );
    const standard = projectOrderPriorityOwnerSlaFacts(
      baseRaw({ orderId: "standard", createdAt: "2026-09-03T00:00:00.000Z" }),
      now,
      now,
    );

    const sorted = [
      {
        orderId: "standard",
        createdAt: "2026-09-03T00:00:00.000Z",
        facts: standard,
      },
      {
        orderId: "overdue",
        createdAt: "2026-09-04T00:00:00.000Z",
        facts: overdue,
      },
      {
        orderId: "panic",
        createdAt: "2026-09-05T00:00:00.000Z",
        facts: panic,
        hasComplaint: true,
      },
    ].sort(compareOrderPoolQueueItems);

    expect(sorted.map((row) => row.orderId)).toEqual(["panic", "overdue", "standard"]);
  });

  it("exposes dispatch panic helper for feed adapters", () => {
    expect(isDispatchPanicFromUrgency("panic")).toBe(true);
    expect(isDispatchPanicFromUrgency("standard")).toBe(false);
  });
});
