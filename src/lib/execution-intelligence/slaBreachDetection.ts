import { DEFAULT_QUEUE_SLA } from "@/lib/persistent-queues/queueFreshnessSla";
import type { ExecutionIntelligenceQueueItem, SlaAssessment, SlaSeverity } from "./executionIntelligenceTypes";

function ageHours(nowIso: string, anchor: string): number {
  return (new Date(nowIso).getTime() - new Date(anchor).getTime()) / (1000 * 60 * 60);
}

export function assessQueueSla(item: ExecutionIntelligenceQueueItem, nowIso: string): SlaAssessment {
  const policy = DEFAULT_QUEUE_SLA[item.queueType] ?? DEFAULT_QUEUE_SLA.default;
  const age = ageHours(nowIso, item.createdAt);
  let severity: SlaSeverity = "fresh";
  let breachReason: string | null = null;

  if (item.slaDueAt && new Date(nowIso).getTime() > new Date(item.slaDueAt).getTime()) {
    severity = "breached";
    breachReason = "SLA due time passed";
  } else if (age >= policy.breachAfterHours) {
    severity = "breached";
    breachReason = `Age ${age.toFixed(1)}h exceeds breach threshold ${policy.breachAfterHours}h`;
  } else if (age >= policy.staleAfterHours) {
    severity = "aging";
    breachReason = `Age ${age.toFixed(1)}h exceeds stale threshold ${policy.staleAfterHours}h`;
  }

  const hasBlocker = Boolean(item.blockerCode || item.blockerSummary);
  const escalated = item.escalationLevel !== "none";
  if (severity === "breached" && (hasBlocker || escalated || item.state === "blocked")) {
    severity = "critical";
    breachReason = [breachReason, hasBlocker ? "blocker active" : null, escalated ? "escalated" : null]
      .filter(Boolean)
      .join("; ");
  }

  const customerRiskWeight =
    severity === "critical" ? 1 : severity === "breached" ? 0.75 : severity === "aging" ? 0.4 : 0.1;

  const recommendation =
    severity === "critical"
      ? "Immediate CMD review — blocker or escalation on breached SLA"
      : severity === "breached"
        ? "Prioritize ownership and clear blocker or reassign"
        : severity === "aging"
          ? "Monitor — approaching SLA breach"
          : "Within SLA — continue execution";

  return {
    queueItemId: item.id,
    severity,
    ageHours: age,
    breachReason,
    recommendation,
    customerRiskWeight,
  };
}

export function detectSlaBreaches(
  items: ExecutionIntelligenceQueueItem[],
  nowIso: string,
): SlaAssessment[] {
  const open = items.filter((i) => !["completed", "cancelled"].includes(i.state));
  return open.map((item) => assessQueueSla(item, nowIso)).sort((a, b) => {
    const rank: Record<SlaSeverity, number> = { critical: 0, breached: 1, aging: 2, fresh: 3 };
    return rank[a.severity] - rank[b.severity] || b.ageHours - a.ageHours;
  });
}
