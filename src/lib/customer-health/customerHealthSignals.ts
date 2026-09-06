import type {
  CustomerHealthProjectionInput,
  CustomerHealthSignalFact,
  CustomerHealthUnavailableSignal,
} from "./customerHealthTypes";

const MS_PER_DAY = 86_400_000;
const COMMUNICATION_STALE_DAYS = 30;
const COMMUNICATION_AGING_DAYS = 14;

const OPEN_TICKET_STATUSES = new Set(["open", "in_progress", "pending", "escalated"]);
const TERMINAL_TASK_STATUSES = new Set(["completed", "done", "cancelled", "closed"]);
const FULFILMENT_CONCERN_STATUSES = new Set([
  "on_hold",
  "finance_hold",
  "complaint_hold",
  "blocked",
  "pending_approval",
  "awaiting_payment",
  "awaiting_finance_release",
]);

function freshnessFromAgeDays(ageDays: number | null): CustomerHealthSignalFact["freshness"] {
  if (ageDays === null) return "unknown";
  if (ageDays <= COMMUNICATION_AGING_DAYS) return "fresh";
  if (ageDays <= COMMUNICATION_STALE_DAYS) return "aging";
  return "stale";
}

function daysBetween(nowMs: number, iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((nowMs - parsed) / MS_PER_DAY));
}

function extractCreditSignals(
  input: CustomerHealthProjectionInput,
): { facts: CustomerHealthSignalFact[]; unavailable: CustomerHealthUnavailableSignal[] } {
  const facts: CustomerHealthSignalFact[] = [];
  const unavailable: CustomerHealthUnavailableSignal[] = [
    {
      signalId: "finance_ageing_exposure",
      availability: "unavailable",
      programmeOwner: "POINT77",
      reason: "Finance ageing buckets and consolidated exposure (Points 77–81) are not yet governed.",
    },
  ];

  const outstanding = input.profile.totalOutstanding ?? 0;
  const creditLimit = input.profile.creditLimit ?? 0;
  const allowCredit = input.profile.allowCredit ?? false;

  facts.push({
    signalId: "credit_outstanding_balance",
    availability: "available",
    label: "Outstanding balance",
    value: `₹${outstanding.toLocaleString("en-IN")}`,
    observedAt: input.profile.observedAt,
    sourceAuthority: "companies.total_outstanding",
    sourceRecordId: input.companyId,
    freshness: input.profile.observedAt ? "fresh" : "unknown",
    contributesToRisk: outstanding > 0 && !allowCredit,
  });

  if (creditLimit > 0) {
    const utilizationPct = Math.round((outstanding / creditLimit) * 100);
    facts.push({
      signalId: "credit_limit_utilization",
      availability: "available",
      label: "Credit limit utilization",
      value: `${utilizationPct}% (₹${outstanding.toLocaleString("en-IN")} of ₹${creditLimit.toLocaleString("en-IN")})`,
      observedAt: input.profile.observedAt,
      sourceAuthority: "companies.credit_limit",
      sourceRecordId: input.companyId,
      freshness: input.profile.observedAt ? "fresh" : "unknown",
      contributesToRisk: utilizationPct >= 90,
    });
  }

  return { facts, unavailable };
}

function extractSupportSignals(input: CustomerHealthProjectionInput): CustomerHealthSignalFact[] {
  const openTickets = input.tickets.filter((t) => OPEN_TICKET_STATUSES.has(t.status.toLowerCase()));
  const latest = openTickets
    .map((t) => t.createdAt)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  return [
    {
      signalId: "open_support_tickets",
      availability: "available",
      label: "Open support tickets",
      value: `${openTickets.length} open (${input.tickets.length} total linked)`,
      observedAt: latest,
      sourceAuthority: "support_tickets",
      sourceRecordId: openTickets[0]?.id ?? null,
      freshness: freshnessFromAgeDays(daysBetween(Date.now(), latest)),
      contributesToRisk: openTickets.length > 0,
    },
  ];
}

function extractEngagementSignals(
  input: CustomerHealthProjectionInput,
  nowMs: number,
): CustomerHealthSignalFact[] {
  const sorted = [...input.communications].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
  const latest = sorted[0] ?? null;
  const ageDays = latest ? daysBetween(nowMs, latest.occurredAt) : null;

  return [
    {
      signalId: "communication_recency",
      availability: "available",
      label: "Last governed CRM communication",
      value: latest
        ? ageDays === 0
          ? "Today"
          : ageDays === 1
            ? "1 day ago"
            : ageDays !== null
              ? `${ageDays} days ago`
              : "Unknown recency"
        : "No governed communications recorded",
      observedAt: latest?.occurredAt ?? null,
      sourceAuthority: "client_interactions",
      sourceRecordId: latest?.entryId ?? null,
      freshness: latest ? freshnessFromAgeDays(ageDays) : "unknown",
      contributesToRisk: ageDays !== null ? ageDays >= COMMUNICATION_STALE_DAYS : input.communications.length === 0,
    },
  ];
}

function extractTaskSignals(input: CustomerHealthProjectionInput, nowIso: string): CustomerHealthSignalFact[] {
  const nowMs = Date.parse(nowIso);
  const overdue = input.tasks.filter((task) => {
    if (!task.dueDate) return false;
    if (TERMINAL_TASK_STATUSES.has((task.status ?? "").toLowerCase())) return false;
    const dueMs = Date.parse(task.dueDate);
    return !Number.isNaN(dueMs) && dueMs < nowMs;
  });

  const latestDue = overdue.map((t) => t.dueDate).filter(Boolean).sort()[0] ?? null;

  return [
    {
      signalId: "overdue_crm_tasks",
      availability: "available",
      label: "Overdue CRM tasks",
      value: `${overdue.length} overdue (${input.tasks.length} total)`,
      observedAt: latestDue,
      sourceAuthority: "crm_tasks",
      sourceRecordId: overdue[0]?.id ?? null,
      freshness: latestDue ? freshnessFromAgeDays(daysBetween(nowMs, latestDue)) : "fresh",
      contributesToRisk: overdue.length > 0,
    },
  ];
}

function extractFulfilmentSignals(input: CustomerHealthProjectionInput): CustomerHealthSignalFact[] {
  const stuck = input.orders.filter((order) => {
    const status = (order.status ?? "").toLowerCase();
    return FULFILMENT_CONCERN_STATUSES.has(status);
  });

  const latest = stuck
    .map((o) => o.createdAt)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  return [
    {
      signalId: "stuck_order_fulfilment",
      availability: "available",
      label: "Orders in fulfilment hold states",
      value: stuck.length === 0 ? "None in hold states" : `${stuck.length} order(s) in hold/blocked states`,
      observedAt: latest,
      sourceAuthority: "orders.status",
      sourceRecordId: stuck[0]?.orderId ?? null,
      freshness: latest ? freshnessFromAgeDays(daysBetween(Date.now(), latest)) : "fresh",
      contributesToRisk: stuck.length > 0,
    },
  ];
}

function staticUnavailableSignals(): CustomerHealthUnavailableSignal[] {
  return [
    {
      signalId: "customer_sentiment",
      availability: "unavailable",
      programmeOwner: "POINT64_ML",
      reason: "Unified customer sentiment / NPS is not governed; ticket ratings are not promoted to a health score.",
    },
    {
      signalId: "repeat_order_expectation",
      availability: "unavailable",
      programmeOwner: "POINT64_ML",
      reason: "Repeat-order expectation requires governed predictive authority — not invented here.",
    },
    {
      signalId: "sales_trajectory",
      availability: "unavailable",
      programmeOwner: "POINT64_ANALYTICS",
      reason: "Sales growth/decline trajectory requires analytics lane authority — not available in Customer 360.",
    },
  ];
}

export function extractCustomerHealthSignals(
  input: CustomerHealthProjectionInput,
  nowIso: string,
): {
  available: CustomerHealthSignalFact[];
  unavailable: CustomerHealthUnavailableSignal[];
} {
  const nowMs = Date.parse(nowIso);
  const credit = extractCreditSignals(input);
  const available = [
    ...credit.facts,
    ...extractSupportSignals(input),
    ...extractEngagementSignals(input, nowMs),
    ...extractTaskSignals(input, nowIso),
    ...extractFulfilmentSignals(input),
  ];
  const unavailable = [...credit.unavailable, ...staticUnavailableSignals()];
  return { available, unavailable };
}
