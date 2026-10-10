export type SupportTicketLifecycleFacts = {
  status?: string | null;
  sla_first_response_due?: string | null;
  sla_action_due?: string | null;
  sla_resolution_due?: string | null;
  sla_first_response_at?: string | null;
  sla_action_at?: string | null;
  sla_resolved_at?: string | null;
};

export type SupportTicketSlaState = "On Time" | "Late" | "No Response" | "NEVER_RESPONDED";

export const SUPPORT_TICKET_TERMINAL_STATUSES = ["resolved", "closed", "rejected", "cancelled"] as const;
const TERMINAL_SUPPORT_STATUSES = new Set<string>(SUPPORT_TICKET_TERMINAL_STATUSES);

function normalizedStatus(status: string | null | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}

function parsedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isSupportTicketActive(ticket: Pick<SupportTicketLifecycleFacts, "status">): boolean {
  return !TERMINAL_SUPPORT_STATUSES.has(normalizedStatus(ticket.status));
}

/**
 * Derive the same SLA truth for queue badges, management KPIs, and resolution writes.
 * A resolved ticket is evaluated at its actual resolution timestamp so a later clock
 * cannot retrospectively turn an on-time resolution into a breach.
 */
export function computeSupportTicketSlaState(
  ticket: SupportTicketLifecycleFacts,
  now: Date = new Date(),
): SupportTicketSlaState {
  const resolvedAt = parsedTime(ticket.sla_resolved_at);
  const evaluationTime = resolvedAt ?? now.getTime();
  const firstDue = parsedTime(ticket.sla_first_response_due);
  const firstAt = parsedTime(ticket.sla_first_response_at);
  const actionDue = parsedTime(ticket.sla_action_due);
  const actionAt = parsedTime(ticket.sla_action_at);
  const resolutionDue = parsedTime(ticket.sla_resolution_due);

  if (resolutionDue !== null && evaluationTime > resolutionDue) {
    return firstAt === null ? "NEVER_RESPONDED" : "Late";
  }
  if (actionDue !== null && evaluationTime > actionDue && (actionAt === null || actionAt > actionDue)) {
    return "Late";
  }
  if (firstDue !== null && evaluationTime > firstDue && (firstAt === null || firstAt > firstDue)) {
    return firstAt === null ? "No Response" : "Late";
  }
  return "On Time";
}

export function isSupportTicketSlaBreached(ticket: SupportTicketLifecycleFacts, now: Date = new Date()): boolean {
  if (!isSupportTicketActive(ticket)) return false;
  return computeSupportTicketSlaState(ticket, now) !== "On Time";
}
