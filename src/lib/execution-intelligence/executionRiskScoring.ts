import type {
  ExecutionIntelligenceInput,
  ExecutionIntelligenceQueueItem,
  ExecutionRiskAssessment,
  ExecutionRiskLevel,
} from "./executionIntelligenceTypes";
import { assessQueueSla } from "./slaBreachDetection";

function levelFromScore(score: number): ExecutionRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export function scoreQueueItemRisk(
  item: ExecutionIntelligenceQueueItem,
  input: ExecutionIntelligenceInput,
): ExecutionRiskAssessment {
  const signals: string[] = [];
  let score = 0;

  const sla = assessQueueSla(item, input.nowIso);
  if (sla.severity === "critical") {
    score += 35;
    signals.push("critical_sla");
  } else if (sla.severity === "breached") {
    score += 25;
    signals.push("sla_breached");
  } else if (sla.severity === "aging") {
    score += 10;
    signals.push("sla_aging");
  }

  if (item.state === "blocked") {
    score += 20;
    signals.push("queue_blocked");
  }
  if (item.escalationLevel !== "none") {
    score += 15;
    signals.push(`escalation_${item.escalationLevel}`);
  }
  if (!item.assignedTo) {
    score += 12;
    signals.push("ownership_vacancy");
  }

  const entityScans = input.scans.filter(
    (s) => s.entityType === item.entityType && s.entityId === item.entityId,
  );
  const mismatches = entityScans.filter((s) => s.verificationStatus === "mismatch").length;
  if (mismatches > 0) {
    score += Math.min(20, mismatches * 8);
    signals.push(`scan_mismatch_x${mismatches}`);
  }
  const gatePending = entityScans.filter(
    (s) => s.scanType === "dispatch_gate" && s.verificationStatus !== "verified",
  ).length;
  if (gatePending > 0) {
    score += 15;
    signals.push("unresolved_gate_scan");
  }

  const escalationEvents = input.events.filter(
    (e) =>
      e.entityId === item.entityId &&
      (e.eventType.includes("escalat") || e.eventType.includes("failed")),
  ).length;
  if (escalationEvents >= 2) {
    score += 10;
    signals.push("repeated_escalation_events");
  }

  const assignEvents = input.events.filter((e) => e.eventType === "queue_assigned" && e.queueItemId === item.id)
    .length;
  if (assignEvents >= 3) {
    score += 8;
    signals.push("reassignment_churn");
  }

  score = Math.min(100, score);

  return {
    entityKey: `${item.entityType}:${item.entityId}`,
    entityType: item.entityType,
    entityId: item.entityId,
    orderId: item.orderId,
    level: levelFromScore(score),
    score,
    signals,
  };
}

export function rankExecutionRisks(input: ExecutionIntelligenceInput): ExecutionRiskAssessment[] {
  const open = input.queueItems.filter((i) => !["completed", "cancelled"].includes(i.state));
  const byEntity = new Map<string, ExecutionRiskAssessment>();
  for (const item of open) {
    const risk = scoreQueueItemRisk(item, input);
    const prev = byEntity.get(risk.entityKey);
    if (!prev || risk.score > prev.score) byEntity.set(risk.entityKey, risk);
  }
  return [...byEntity.values()].sort((a, b) => b.score - a.score);
}

export function computeExecutionConfidence(risks: ExecutionRiskAssessment[], openCount: number): number {
  if (openCount === 0) return 100;
  const critical = risks.filter((r) => r.level === "critical").length;
  const high = risks.filter((r) => r.level === "high").length;
  const penalty = critical * 12 + high * 6 + risks.length * 2;
  return Math.max(0, Math.min(100, 100 - penalty));
}
