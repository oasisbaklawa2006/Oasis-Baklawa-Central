import type { BuyerGeneralQuery, BuyerTicket } from "@/lib/customerApp/customerAppClient";

export type BuyerCommunicationLogKind = "order_ticket" | "general_enquiry";

export type BuyerCommunicationLogEntry = {
  id: string;
  kind: BuyerCommunicationLogKind;
  createdAt: string;
  ticket?: BuyerTicket;
  query?: BuyerGeneralQuery;
};

function entryTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Merges governed order tickets and general enquiries into one newest-first communication log. */
export function buildBuyerCommunicationLog(
  tickets: BuyerTicket[],
  generalQueries: BuyerGeneralQuery[],
): BuyerCommunicationLogEntry[] {
  const ticketEntries = tickets.map((ticket) => ({
    id: `ticket:${ticket.ticket_id}`,
    kind: "order_ticket" as const,
    createdAt: ticket.created_at,
    ticket,
  }));
  const queryEntries = generalQueries.map((query) => ({
    id: `query:${query.query_id}`,
    kind: "general_enquiry" as const,
    createdAt: query.created_at,
    query,
  }));
  return [...ticketEntries, ...queryEntries].sort(
    (left, right) => entryTimestamp(right.createdAt) - entryTimestamp(left.createdAt),
  );
}

/** Counts customer-visible communication records across both governed read models. */
export function buyerCommunicationLogCount(tickets: BuyerTicket[], generalQueries: BuyerGeneralQuery[]): number {
  return tickets.length + generalQueries.length;
}
