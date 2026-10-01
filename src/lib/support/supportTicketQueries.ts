import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import {
  isSupportTicketActive,
  SUPPORT_TICKET_TERMINAL_STATUSES,
} from "./supportTicketPolicy";

export type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];

export type SupportTicketQueryResult = {
  data: SupportTicketRow[];
  error: { message: string } | null;
};

const SUPPORT_TICKET_PAGE_SIZE = 500;
const ACTIVE_STATUS_FILTER =
  `status.is.null,status.not.in.(${SUPPORT_TICKET_TERMINAL_STATUSES.join(",")})`;

/**
 * Load the complete active-ticket population with stable pagination.
 *
 * The PostgREST API enforces a server row cap per response, so callers must not
 * treat one SELECT response as a complete operational queue. The server filter
 * excludes canonical lowercase terminal states; the shared client predicate is
 * applied again so case variants such as "CANCELLED" remain terminal too.
 */
export async function loadActiveSupportTicketsPaginated(): Promise<SupportTicketQueryResult> {
  const rows: SupportTicketRow[] = [];
  let offset = 0;
  let expectedTotal: number | null = null;

  for (;;) {
    const { data, error, count } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact" })
      .or(ACTIVE_STATUS_FILTER)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + SUPPORT_TICKET_PAGE_SIZE - 1);

    if (error) {
      return { data: [], error: { message: error.message } };
    }

    const page = (data ?? []) as SupportTicketRow[];
    rows.push(...page.filter(isSupportTicketActive));
    expectedTotal = count ?? expectedTotal;

    if (page.length === 0) break;
    offset += page.length;
    if (expectedTotal !== null && offset >= expectedTotal) break;
  }

  return { data: rows, error: null };
}
