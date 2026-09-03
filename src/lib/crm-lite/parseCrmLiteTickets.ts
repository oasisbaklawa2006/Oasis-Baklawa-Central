import type { CrmLiteTicket } from "@/lib/crm-lite/salesCrmLiteTypes";

type TicketOrderJoin = {
  company_id: string | null;
  order_number: string | null;
};

function parseTicketOrderJoin(value: unknown): TicketOrderJoin | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  if (!("company_id" in row) && !("order_number" in row)) return null;
  return {
    company_id: typeof row.company_id === "string" ? row.company_id : null,
    order_number: typeof row.order_number === "string" ? row.order_number : null,
  };
}

/** Normalizes Supabase nested `order:orders(...)` rows for CRM-lite ticket lenses. */
export function parseCrmLiteTickets(rows: unknown): CrmLiteTicket[] {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const ticket = row as Record<string, unknown>;
    if (typeof ticket.id !== "string" || typeof ticket.order_id !== "string") return [];

    return [{
      id: ticket.id,
      order_id: ticket.order_id,
      issue_type: typeof ticket.issue_type === "string" ? ticket.issue_type : "",
      status: typeof ticket.status === "string" ? ticket.status : "",
      severity: typeof ticket.severity === "string" ? ticket.severity : null,
      created_at: typeof ticket.created_at === "string" ? ticket.created_at : null,
      commission_blocked: typeof ticket.commission_blocked === "boolean" ? ticket.commission_blocked : null,
      customer_rating: typeof ticket.customer_rating === "number" ? ticket.customer_rating : null,
      admin_rating_speed: typeof ticket.admin_rating_speed === "number" ? ticket.admin_rating_speed : null,
      admin_rating_quality: typeof ticket.admin_rating_quality === "number" ? ticket.admin_rating_quality : null,
      admin_rating_communication: typeof ticket.admin_rating_communication === "number" ? ticket.admin_rating_communication : null,
      sla_resolution_due: typeof ticket.sla_resolution_due === "string" ? ticket.sla_resolution_due : null,
      sla_resolved_at: typeof ticket.sla_resolved_at === "string" ? ticket.sla_resolved_at : null,
      order: parseTicketOrderJoin(ticket.order),
    }];
  });
}
