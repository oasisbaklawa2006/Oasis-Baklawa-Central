import type {
  Customer360CompanyProfile,
  Customer360DeliverySite,
  Customer360FinanceExposure,
  Customer360HealthReadModel,
  Customer360InteractionSummary,
  Customer360TaskSummary,
} from "./customer360Types";

type DeliveryAddressRow = {
  id: string;
  label: string;
  street_address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string | null;
  contact_phone: string | null;
  is_default: boolean | null;
};

export function mapDeliveryAddressRow(row: DeliveryAddressRow): Customer360DeliverySite {
  return {
    id: row.id,
    label: row.label,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    isDefault: Boolean(row.is_default),
  };
}

/** Factual finance exposure from company profile — no invented ageing buckets. */
export function buildFinanceExposureFromProfile(
  profile: Customer360CompanyProfile,
): Customer360FinanceExposure {
  const creditLimit = profile.creditLimit;
  const totalOutstanding = profile.totalOutstanding ?? 0;
  const creditHeadroom =
    creditLimit != null && creditLimit > 0 ? Math.max(0, creditLimit - totalOutstanding) : null;

  return {
    totalOutstanding,
    currentBalance: profile.currentBalance,
    creditLimit,
    walletBalance: profile.walletBalance,
    allowCredit: profile.allowCredit,
    paymentTerms: profile.paymentTerms,
    creditHeadroom,
  };
}

function daysBetween(isoDate: string | null, now = Date.now()): number | null {
  if (!isoDate) return null;
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now - parsed) / (1000 * 60 * 60 * 24));
}

function latestInteractionDate(interactions: Customer360InteractionSummary[]): string | null {
  let latest: string | null = null;
  for (const item of interactions) {
    if (!item.createdAt) continue;
    if (!latest || Date.parse(item.createdAt) > Date.parse(latest)) {
      latest = item.createdAt;
    }
  }
  return latest;
}

/** Deterministic health signals and next-best-actions from factual CRM data only. */
export function buildCustomerHealthReadModel(
  profile: Customer360CompanyProfile,
  tasks: Customer360TaskSummary[],
  interactions: Customer360InteractionSummary[],
  now = Date.now(),
): Customer360HealthReadModel {
  const today = new Date(now).toISOString().slice(0, 10);
  const overdueTaskCount = tasks.filter(
    (task) => task.status === "pending" && task.dueDate && task.dueDate < today,
  ).length;

  const lastInteractionAt = latestInteractionDate(interactions);
  const daysSinceLastInteraction = daysBetween(lastInteractionAt, now);

  const totalOutstanding = profile.totalOutstanding ?? 0;
  const creditLimit = profile.creditLimit;
  const creditUtilizationPercent =
    creditLimit != null && creditLimit > 0
      ? Math.round((totalOutstanding / creditLimit) * 100)
      : null;

  const signals: Customer360HealthReadModel["signals"] = [];

  if (overdueTaskCount > 0) {
    signals.push({
      signal: "overdue_tasks",
      severity: overdueTaskCount >= 3 ? "critical" : "warning",
      factualBasis: `${overdueTaskCount} pending CRM task(s) are past due.`,
    });
  }

  if (daysSinceLastInteraction != null && daysSinceLastInteraction > 30) {
    signals.push({
      signal: "stale_engagement",
      severity: daysSinceLastInteraction > 60 ? "warning" : "info",
      factualBasis: `Last logged interaction was ${daysSinceLastInteraction} day(s) ago.`,
    });
  } else if (interactions.length === 0) {
    signals.push({
      signal: "no_interactions",
      severity: "info",
      factualBasis: "No CRM-lite interactions are recorded for this company.",
    });
  }

  if (totalOutstanding > 0) {
    signals.push({
      signal: "outstanding_balance",
      severity: totalOutstanding > (creditLimit ?? 0) && creditLimit != null && creditLimit > 0
        ? "critical"
        : "info",
      factualBasis: `₹${totalOutstanding.toLocaleString()} outstanding on company profile.`,
    });
  }

  if (creditUtilizationPercent != null && creditUtilizationPercent >= 80) {
    signals.push({
      signal: "high_credit_utilization",
      severity: creditUtilizationPercent >= 95 ? "critical" : "warning",
      factualBasis: `Outstanding balance is ${creditUtilizationPercent}% of the configured credit limit.`,
    });
  }

  if (profile.allowCredit === false && totalOutstanding > 0) {
    signals.push({
      signal: "credit_disabled_with_balance",
      severity: "warning",
      factualBasis: "Credit is disabled while an outstanding balance remains on the company profile.",
    });
  }

  const opportunityTasks = tasks.filter((task) =>
    ["opportunity", "sample", "sample_request"].includes((task.taskType ?? "").toLowerCase()),
  );
  if (opportunityTasks.some((task) => task.status === "pending")) {
    signals.push({
      signal: "open_opportunity_or_sample",
      severity: "info",
      factualBasis: "Pending opportunity or sample follow-up task(s) exist in CRM-lite.",
    });
  }

  const nextBestActions: Customer360HealthReadModel["nextBestActions"] = [];

  if (overdueTaskCount > 0) {
    nextBestActions.push({
      key: "overdue_tasks",
      action: "Complete or reschedule overdue CRM tasks",
      reason: `${overdueTaskCount} task(s) are past due.`,
      priority: 1,
    });
  }

  if (daysSinceLastInteraction == null || daysSinceLastInteraction >= 14) {
    nextBestActions.push({
      key: "log_interaction",
      action: "Log a call, visit, or WhatsApp interaction",
      reason:
        daysSinceLastInteraction == null
          ? "No interaction history is recorded for this account."
          : `No interaction logged in the last ${daysSinceLastInteraction} day(s).`,
      priority: overdueTaskCount > 0 ? 2 : 1,
    });
  }

  const pendingFollowUps = interactions.filter(
    (item) => item.followUpDate && item.followUpDate <= today,
  );
  if (pendingFollowUps.length > 0) {
    nextBestActions.push({
      key: "due_follow_ups",
      action: "Execute due interaction follow-ups",
      reason: `${pendingFollowUps.length} interaction follow-up date(s) are due or overdue.`,
      priority: 2,
    });
  }

  if (creditUtilizationPercent != null && creditUtilizationPercent >= 80) {
    nextBestActions.push({
      key: "credit_review",
      action: "Review credit exposure with finance before promising additional credit",
      reason: `Credit utilization is ${creditUtilizationPercent}% of limit.`,
      priority: 3,
    });
  }

  nextBestActions.sort((left, right) => left.priority - right.priority);

  return {
    signals,
    nextBestActions,
    overdueTaskCount,
    daysSinceLastInteraction,
    creditUtilizationPercent,
  };
}
