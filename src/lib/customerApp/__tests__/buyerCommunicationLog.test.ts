import { describe, expect, it } from "vitest";
import { buildBuyerCommunicationLog, buyerCommunicationLogCount } from "@/lib/customerApp/buyerCommunicationLog";
import type { BuyerGeneralQuery, BuyerTicket } from "@/lib/customerApp/customerAppClient";

const ticket = (overrides: Partial<BuyerTicket> & Pick<BuyerTicket, "ticket_id">): BuyerTicket => ({
  order_id: "order-1",
  order_number: "SO2026/09-0001",
  issue_type: "Damaged Goods",
  description: "Carton dented",
  customer_status: "open",
  product_sku: null,
  quantity_affected: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
  first_response_due: null,
  resolution_due: null,
  resolved_at: null,
  customer_rating: null,
  ...overrides,
});

const query = (overrides: Partial<BuyerGeneralQuery> & Pick<BuyerGeneralQuery, "query_id">): BuyerGeneralQuery => ({
  category: "GENERAL",
  subject: "Catalogue question",
  message: "When is the next delivery window?",
  status: "SUBMITTED",
  created_at: "2026-09-02T08:00:00.000Z",
  updated_at: "2026-09-02T08:00:00.000Z",
  ...overrides,
});

describe("buildBuyerCommunicationLog", () => {
  it("returns newest-first chronological entries across tickets and enquiries", () => {
    const entries = buildBuyerCommunicationLog(
      [ticket({ ticket_id: "ticket-1", created_at: "2026-09-01T10:00:00.000Z" })],
      [query({ query_id: "query-1", created_at: "2026-09-02T08:00:00.000Z" })],
    );
    expect(entries.map((entry) => entry.id)).toEqual(["query:query-1", "ticket:ticket-1"]);
    expect(entries[0]?.kind).toBe("general_enquiry");
    expect(entries[1]?.kind).toBe("order_ticket");
  });

  it("counts both governed communication sources", () => {
    expect(buyerCommunicationLogCount(
      [ticket({ ticket_id: "ticket-1" })],
      [query({ query_id: "query-1" })],
    )).toBe(2);
  });
});
