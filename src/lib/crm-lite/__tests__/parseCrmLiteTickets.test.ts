import { describe, expect, it } from "vitest";
import { parseCrmLiteTickets } from "../parseCrmLiteTickets";

describe("parseCrmLiteTickets", () => {
  it("normalizes nested order joins from Supabase select rows", () => {
    const parsed = parseCrmLiteTickets([
      {
        id: "ticket-1",
        order_id: "order-1",
        issue_type: "quality",
        status: "open",
        severity: "high",
        created_at: "2026-09-01T00:00:00.000Z",
        commission_blocked: false,
        customer_rating: 4,
        admin_rating_speed: null,
        admin_rating_quality: null,
        admin_rating_communication: null,
        sla_resolution_due: null,
        sla_resolved_at: null,
        order: { company_id: "company-1", order_number: "SO2026/09-0001" },
      },
      {
        id: "ticket-2",
        order_id: "order-2",
        issue_type: "delivery",
        status: "open",
        severity: null,
        created_at: null,
        commission_blocked: null,
        customer_rating: null,
        admin_rating_speed: null,
        admin_rating_quality: null,
        admin_rating_communication: null,
        sla_resolution_due: null,
        sla_resolved_at: null,
        order: [{ company_id: "company-2", order_number: "SO2026/09-0002" }],
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.order?.company_id).toBe("company-1");
    expect(parsed[1]?.order?.order_number).toBe("SO2026/09-0002");
  });

  it("returns an empty list for invalid payloads", () => {
    expect(parseCrmLiteTickets(null)).toEqual([]);
    expect(parseCrmLiteTickets([{ id: "missing-order-id" }])).toEqual([]);
  });
});
