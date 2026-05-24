import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { ExecutionOperationalEventKind } from "./types";
import { DEFAULT_DISPATCH_GRAPH } from "@/lib/execution-engine/executionDependencies";
import { evaluateLaneStates, isDispatchLaneBlocked } from "@/lib/execution-engine/executionBlocking";
import type { ExecutionSatisfaction } from "@/lib/execution-engine/executionBlocking";
import { deriveExecutionEscalations } from "@/lib/execution-engine/executionEscalations";
import { summarizeExecutionRisk } from "@/lib/execution-engine/executionRiskEngine";

const SOURCE = "derived_execution_engine" as const;

export interface ExecutionOperationalFeedInput {
  satisfaction: ExecutionSatisfaction;
}

export function buildExecutionOperationalFeed(input: ExecutionOperationalFeedInput): OperationalEventRecord[] {
  const states = evaluateLaneStates(DEFAULT_DISPATCH_GRAPH, input.satisfaction);
  const blocked = isDispatchLaneBlocked(states);
  const esc = deriveExecutionEscalations(states);
  const risk = summarizeExecutionRisk(states);
  let sortKey = 9000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "cmd", displayLabel: "Execution dependency projection" };
  const out: OperationalEventRecord[] = [];

  const nominal = risk.blockedLanes === 0 && risk.pendingLanes === 0;
  out.push({
    id: "exec-engine:readiness:summary",
    kind: ExecutionOperationalEventKind.DEPENDENCY_UNSATISFIED,
    category: "operational",
    severity: nominal ? "info" : "warning",
    title: nominal ? "Execution graph nominal (projection)" : "Execution graph attention needed",
    detail: nominal
      ? "All evaluated lanes satisfied for the supplied satisfaction snapshot."
      : deriveExecutionEscalations(states).join("\n") || "See lane states.",
    occurredAt: null,
    sortKey: next(),
    actor,
    entities: [],
    source: SOURCE,
  });

  if (blocked) {
    out.push({
      id: "exec-engine:dispatch:blocked",
      kind: ExecutionOperationalEventKind.DISPATCH_BLOCKED,
      category: "dispatch",
      severity: "urgent",
      title: "Dispatch lane blocked",
      detail: esc.join("\n") || "Dependency graph unsatisfied for dispatch.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "order", id: "dispatch-lane" }],
      source: SOURCE,
    });
  }

  if (risk.blockedLanes > 0 || risk.pendingLanes > 0) {
    out.push({
      id: "exec-engine:bottleneck",
      kind: ExecutionOperationalEventKind.BOTTLENECK_DETECTED,
      category: "escalation",
      severity: risk.blockedLanes > 1 ? "urgent" : "warning",
      title: "Operational bottleneck (readiness)",
      detail: `Blocked lanes · ${risk.blockedLanes} · Pending lanes · ${risk.pendingLanes} · First bottleneck · ${risk.bottleneckLane ?? "n/a"}`,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}
