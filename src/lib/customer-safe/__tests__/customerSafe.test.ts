import { describe, expect, it } from "vitest";
import { isSuppressedInternalLabel } from "../customerSafeStatus";
import { filterCustomerSafeTimelineInputs, projectCustomerSafeTimeline, sanitizeCustomerLabel } from "../customerSafeTimeline";
import { projectCustomerSafeOrder } from "../customerProjection";

describe("customer-safe projections", () => {
  it("suppresses internal governance labels", () => {
    expect(isSuppressedInternalLabel("finance hold on order")).toBe(true);
    expect(isSuppressedInternalLabel("Order received")).toBe(false);
  });

  it("rejects operational visibility class for customer_safe", () => {
    const filtered = filterCustomerSafeTimelineInputs([
      {
        id: "op",
        at: "2026-01-01T00:00:00Z",
        title: "Neutral production update",
        visibilityClass: "operational",
      },
      {
        id: "ok",
        at: "2026-01-01T00:00:00Z",
        title: "Order placed",
        visibilityClass: "public_curated",
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("ok");
  });

  it("filters governance and escalation events from timeline", () => {
    const filtered = filterCustomerSafeTimelineInputs([
      {
        id: "1",
        at: "2026-01-01T00:00:00Z",
        title: "Order placed",
        visibilityClass: "public_curated",
      },
      {
        id: "2",
        at: "2026-01-01T01:00:00Z",
        title: "CMD escalation dispute",
        visibilityClass: "escalation_internal",
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).not.toMatch(/escalation/i);
  });

  it("sanitizes panic and finance hold vocabulary", () => {
    expect(sanitizeCustomerLabel("dispatch panic hold")).not.toMatch(/panic/i);
  });

  it("projects customer-safe order with active status", () => {
    const p = projectCustomerSafeOrder({
      orderId: "o1",
      displayLabel: "SO-1001",
      activeStatus: "in_preparation",
      timelineEvents: [
        {
          id: "e1",
          at: "2026-01-01T00:00:00Z",
          title: "Order received",
          visibilityClass: "public_curated",
        },
      ],
    });
    expect(p.statuses.find((s) => s.code === "in_preparation")?.active).toBe(true);
    expect(projectCustomerSafeTimeline([])).toEqual([]);
  });
});
