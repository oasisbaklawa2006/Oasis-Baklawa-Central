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
 *
 * Pagination uses a (created_at, id) keyset cursor rather than offset/range:
 * offset pagination re-evaluates the full ordering on every request, so a row
 * inserted or updated ahead of the current boundary between page requests can
 * shift subsequent offsets and duplicate or skip an active ticket. Keyset
 * pagination anchors each page to the last row actually returned, which is
 * stable under concurrent writes.
 *
 * created_at is nullable, and Postgres sorts NULL first under DESC order, so
 * a cursor can legitimately land on a null-created_at row. `lt`/`eq` never
 * match NULL, so the cursor branches on whether the anchor row's created_at
 * is null: when it is, the next page is every non-null row plus the
 * remaining null-created_at rows ordered after this id; otherwise it is the
 * usual (created_at, id) boundary.
 */
export async function loadActiveSupportTicketsPaginated(): Promise<SupportTicketQueryResult> {
  const rows: SupportTicketRow[] = [];
  let cursor: { createdAt: string | null; id: string } | null = null;

  for (;;) {
    let query = supabase
      .from("support_tickets")
      .select("*")
      .or(ACTIVE_STATUS_FILTER)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(SUPPORT_TICKET_PAGE_SIZE);

    if (cursor) {
      query =
        cursor.createdAt === null
          ? query.or(`created_at.not.is.null,and(created_at.is.null,id.gt.${cursor.id})`)
          : query.or(
              `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
            );
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: { message: error.message } };
    }

    const page = (data ?? []) as SupportTicketRow[];
    rows.push(...page.filter(isSupportTicketActive));

    if (page.length < SUPPORT_TICKET_PAGE_SIZE) break;

    const last = page[page.length - 1];
    cursor = { createdAt: last.created_at, id: last.id as string };
  }

  return { data: rows, error: null };
}
