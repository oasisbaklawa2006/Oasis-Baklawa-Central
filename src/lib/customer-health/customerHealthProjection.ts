import type {
  CustomerHealthCategory,
  CustomerHealthNextBestAction,
  CustomerHealthProjectionInput,
  CustomerHealthReadModel,
  CustomerHealthRiskDimension,
  CustomerHealthRiskLevel,
  CustomerHealthSignalFact,
  CustomerHealthUnavailableSignal,
} from "./customerHealthTypes";
import { extractCustomerHealthSignals } from "./customerHealthSignals";

function levelFromScore(score: number): CustomerHealthRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  if (score > 0) return "low";
  return "none";
}

function scoreCommercialExposure(facts: CustomerHealthSignalFact[]): number {
  let score = 0;
  for (const fact of facts) {
    if (fact.signalId === "credit_outstanding_balance" && fact.contributesToRisk) score += 35;
    if (fact.signalId === "credit_limit_utilization" && fact.contributesToRisk) score += 40;
  }
  return Math.min(100, score);
}

function scoreSupportComplaint(facts: CustomerHealthSignalFact[]): number {
  const ticketFact = facts.find((f) => f.signalId === "open_support_tickets");
  if (!ticketFact?.contributesToRisk) return 0;
  const match = ticketFact.value.match(/^(\d+) open/);
  const count = match ? Number(match[1]) : 1;
  return Math.min(100, 25 + count * 20);
}

function scoreEngagement(facts: CustomerHealthSignalFact[]): number {
  const fact = facts.find((f) => f.signalId === "communication_recency");
  if (!fact) return 0;
  if (fact.freshness === "stale") return 45;
  if (fact.freshness === "aging") return 20;
  if (fact.value.startsWith("No governed")) return 30;
  return 0;
}

function scoreTaskDiscipline(facts: CustomerHealthSignalFact[]): number {
  const fact = facts.find((f) => f.signalId === "overdue_crm_tasks");
  if (!fact?.contributesToRisk) return 0;
  const match = fact.value.match(/^(\d+) overdue/);
  const count = match ? Number(match[1]) : 1;
  return Math.min(100, 20 + count * 15);
}

function scoreFulfilment(facts: CustomerHealthSignalFact[]): number {
  const fact = facts.find((f) => f.signalId === "stuck_order_fulfilment");
  if (!fact?.contributesToRisk) return 0;
  return 50;
}

function buildRiskDimensions(
  facts: CustomerHealthSignalFact[],
  unavailable: CustomerHealthUnavailableSignal[],
): CustomerHealthRiskDimension[] {
  const bySignal = (ids: CustomerHealthSignalFact["signalId"][]) =>
    facts.filter((f) => ids.includes(f.signalId));

  const dimensions: Array<{
    dimensionId: CustomerHealthRiskDimension["dimensionId"];
    label: string;
    score: number;
    signalIds: CustomerHealthSignalFact["signalId"][];
    unavailableIds: CustomerHealthUnavailableSignal["signalId"][];
  }> = [
    {
      dimensionId: "commercial_exposure",
      label: "Commercial exposure",
      score: scoreCommercialExposure(facts),
      signalIds: ["credit_outstanding_balance", "credit_limit_utilization"],
      unavailableIds: ["finance_ageing_exposure"],
    },
    {
      dimensionId: "support_complaint",
      label: "Support & complaints",
      score: scoreSupportComplaint(facts),
      signalIds: ["open_support_tickets"],
      unavailableIds: ["customer_sentiment"],
    },
    {
      dimensionId: "engagement",
      label: "Engagement recency",
      score: scoreEngagement(facts),
      signalIds: ["communication_recency"],
      unavailableIds: ["repeat_order_expectation"],
    },
    {
      dimensionId: "task_discipline",
      label: "Task follow-through",
      score: scoreTaskDiscipline(facts),
      signalIds: ["overdue_crm_tasks"],
      unavailableIds: [],
    },
    {
      dimensionId: "fulfilment",
      label: "Order fulfilment",
      score: scoreFulfilment(facts),
      signalIds: ["stuck_order_fulfilment"],
      unavailableIds: ["sales_trajectory"],
    },
  ];

  return dimensions.map((d) => ({
    dimensionId: d.dimensionId,
    label: d.label,
    score: d.score,
    level: levelFromScore(d.score),
    contributingFacts: bySignal(d.signalIds),
    unavailableInputs: unavailable.filter((u) => d.unavailableIds.includes(u.signalId)),
  }));
}

function deriveCategory(dimensions: CustomerHealthRiskDimension[]): CustomerHealthCategory {
  const maxScore = Math.max(0, ...dimensions.map((d) => d.score));
  const criticalDims = dimensions.filter((d) => d.level === "critical").length;
  const highDims = dimensions.filter((d) => d.level === "high").length;

  if (criticalDims >= 1 || maxScore >= 80) return "critical";
  if (highDims >= 1 || maxScore >= 55) return "at_risk";
  if (maxScore >= 25) return "watch";
  if (maxScore === 0) return "healthy";
  return "watch";
}

function computeConfidence(
  availableCount: number,
  unavailableCount: number,
  upstreamErrors: string[],
): number {
  if (upstreamErrors.length > 0) return 0;
  const total = availableCount + unavailableCount;
  if (total === 0) return 0;
  const coverage = availableCount / total;
  return Math.max(0, Math.min(100, Math.round(coverage * 100)));
}

export function deriveNextBestActions(
  companyId: string,
  dimensions: CustomerHealthRiskDimension[],
  unavailable: CustomerHealthUnavailableSignal[],
): CustomerHealthNextBestAction[] {
  const actions: CustomerHealthNextBestAction[] = [];
  const push = (action: CustomerHealthNextBestAction) => actions.push(action);

  const support = dimensions.find((d) => d.dimensionId === "support_complaint");
  if (support && support.level !== "none" && support.level !== "low") {
    push({
      actionId: "review-open-tickets",
      priority: 1,
      advisoryLabel: "Review open support tickets and document next steps",
      rationale: support.contributingFacts.map((f) => f.value).join("; "),
      capability: "POINT59_view_tickets",
      staffRouteHint: `/admin/clients/${companyId}#support-tickets`,
      availability: "advisory",
      programmeOwner: "POINT59",
    });
  }

  const engagement = dimensions.find((d) => d.dimensionId === "engagement");
  if (engagement && engagement.score >= 20) {
    push({
      actionId: "re-engage-customer",
      priority: 2,
      advisoryLabel: "Schedule a follow-up call or note via CRM action capture",
      rationale: engagement.contributingFacts[0]?.value ?? "Engagement recency elevated",
      capability: "POINT62_capture_call",
      staffRouteHint: `/sales/dashboard?companyId=${companyId}`,
      availability: "advisory",
      programmeOwner: "POINT62",
    });
  }

  const tasks = dimensions.find((d) => d.dimensionId === "task_discipline");
  if (tasks && tasks.score >= 20) {
    push({
      actionId: "close-overdue-tasks",
      priority: 3,
      advisoryLabel: "Close or reschedule overdue CRM tasks",
      rationale: tasks.contributingFacts[0]?.value ?? "Overdue tasks detected",
      capability: "POINT63_create_task",
      staffRouteHint: `/sales/dashboard?companyId=${companyId}`,
      availability: "advisory",
      programmeOwner: "POINT63",
    });
  }

  const commercial = dimensions.find((d) => d.dimensionId === "commercial_exposure");
  if (commercial && commercial.score >= 30) {
    const financeUnavailable = unavailable.find((u) => u.signalId === "finance_ageing_exposure");
    push({
      actionId: "finance-exposure-review",
      priority: 4,
      advisoryLabel: financeUnavailable
        ? "Escalate to Finance for governed exposure review (Points 77–81)"
        : "Review outstanding balance against credit terms",
      rationale: commercial.contributingFacts.map((f) => f.value).join("; "),
      capability: financeUnavailable ? "POINT77_finance_review" : "POINT59_view_orders",
      staffRouteHint: financeUnavailable ? "/admin/finance-governance" : `/admin/clients/${companyId}#orders`,
      availability: financeUnavailable ? "unavailable" : "advisory",
      programmeOwner: financeUnavailable ? "POINT77" : "POINT59",
    });
  }

  const fulfilment = dimensions.find((d) => d.dimensionId === "fulfilment");
  if (fulfilment && fulfilment.score >= 30) {
    push({
      actionId: "unblock-fulfilment",
      priority: 5,
      advisoryLabel: "Review orders in hold/blocked fulfilment states",
      rationale: fulfilment.contributingFacts[0]?.value ?? "Fulfilment holds detected",
      capability: "POINT59_view_orders",
      staffRouteHint: `/admin/order-management?companyId=${companyId}`,
      availability: "advisory",
      programmeOwner: "POINT59",
    });
  }

  if (actions.length === 0) {
    push({
      actionId: "maintain-relationship",
      priority: 99,
      advisoryLabel: "No elevated risk — maintain regular CRM touchpoints",
      rationale: "All evaluated dimensions are within normal bounds for available signals.",
      capability: "POINT62_capture_note",
      staffRouteHint: `/sales/dashboard?companyId=${companyId}`,
      availability: "advisory",
      programmeOwner: "POINT62",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildCustomerHealthProjection(
  input: CustomerHealthProjectionInput,
  nowIso: string,
): CustomerHealthReadModel {
  if (input.upstreamErrors.length > 0) {
    return {
      companyId: input.companyId,
      projectedAt: nowIso,
      category: "indeterminate",
      confidence: 0,
      riskDimensions: [],
      availableSignals: [],
      unavailableSignals: [
        {
          signalId: "credit_outstanding_balance",
          availability: "unavailable",
          programmeOwner: "POINT64",
          reason: `Health projection blocked: ${input.upstreamErrors.join("; ")}`,
        },
      ],
      nextBestActions: [
        {
          actionId: "resolve-read-errors",
          priority: 1,
          advisoryLabel: "Resolve Customer 360 read errors before trusting health projection",
          rationale: input.upstreamErrors.join("; "),
          capability: "unavailable_not_governed",
          staffRouteHint: null,
          availability: "unavailable",
          programmeOwner: "POINT64",
        },
      ],
    };
  }

  const { available, unavailable } = extractCustomerHealthSignals(input, nowIso);
  const riskDimensions = buildRiskDimensions(available, unavailable);
  const category = deriveCategory(riskDimensions);
  const confidence = computeConfidence(available.length, unavailable.length, input.upstreamErrors);

  return {
    companyId: input.companyId,
    projectedAt: nowIso,
    category,
    confidence,
    riskDimensions,
    availableSignals: available,
    unavailableSignals: unavailable,
    nextBestActions: deriveNextBestActions(input.companyId, riskDimensions, unavailable),
  };
}
