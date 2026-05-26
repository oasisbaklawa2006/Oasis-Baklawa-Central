import { describe, expect, it } from "vitest";
import { projectCustomerTimeline, containsForbiddenTerm } from "../customerTimelineProjection";

const FORBIDDEN = ["finance hold", "escalation", "owner", "department", "cmd", "blocker", "internal", "staff"];

describe("customerTimelineProjection", () => {
  it("outputs only safe step labels", () => {
    const p = projectCustomerTimeline({ orderStatus: "manufacturing" });
    const text = p.steps.map((s) => `${s.label} ${s.description}`).join(" ");
    for (const term of FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });

  it("suppresses internal timeline events", () => {
    const p = projectCustomerTimeline({
      orderStatus: "submitted",
      timelineEvents: [
        {
          id: "1",
          at: "2026-01-01T00:00:00Z",
          title: "Order placed",
          visibilityClass: "public_curated",
        },
        {
          id: "2",
          at: "2026-01-01T01:00:00Z",
          title: "Finance hold escalation by HOD",
          visibilityClass: "finance_internal",
        },
      ],
    });
    expect(p.curatedEvents).toHaveLength(1);
    expect(containsForbiddenTerm("Finance hold")).toBe(true);
  });
});
