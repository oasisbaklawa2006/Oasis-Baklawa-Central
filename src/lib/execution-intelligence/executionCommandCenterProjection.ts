import { analyzeExecutionBottlenecks } from "./executionBottleneckAnalysis";
import { projectCustomerRiskLane } from "./customerRiskProjection";
import { buildCongestionHeatmap } from "./executionCongestion";
import {
  computeExecutionConfidence,
  rankExecutionRisks,
} from "./executionRiskScoring";
import { buildEscalationTopology } from "./escalationTopology";
import type { ExecutionCommandCenterProjection, ExecutionIntelligenceInput } from "./executionIntelligenceTypes";
import { aggregateOperationalEventStream } from "./operationalEventAggregation";
import { buildDepartmentThroughput } from "./operationalThroughput";
import { projectQueueOwnershipMatrix } from "./queueOwnershipProjection";
import {
  listPendingGateVerifications,
  projectScanHotspots,
} from "./scanMonitoringProjection";
import { detectSlaBreaches } from "./slaBreachDetection";

export function buildExecutionCommandCenterProjection(
  input: ExecutionIntelligenceInput,
): ExecutionCommandCenterProjection {
  const open = input.queueItems.filter((i) => !["completed", "cancelled"].includes(i.state));
  const slaBreaches = detectSlaBreaches(input.queueItems, input.nowIso);
  const risks = rankExecutionRisks(input);

  return {
    generatedAt: input.nowIso,
    globalQueuePressure: {
      open: open.length,
      breached: slaBreaches.filter((s) => s.severity === "breached" || s.severity === "critical").length,
      blocked: open.filter((i) => i.state === "blocked" || i.blockerCode).length,
      escalated: open.filter((i) => i.escalationLevel !== "none").length,
    },
    slaBreaches: slaBreaches.slice(0, 30),
    escalationHotspots: buildEscalationTopology(input).slice(0, 12),
    congestionHeatmap: buildCongestionHeatmap(input),
    ordersAtRisk: risks.slice(0, 20),
    customerRiskLane: projectCustomerRiskLane(input),
    bottlenecks: analyzeExecutionBottlenecks(input).slice(0, 25),
    scanHotspots: projectScanHotspots(input).slice(0, 15),
    pendingGateVerifications: listPendingGateVerifications(input.scans),
    ownershipMatrix: projectQueueOwnershipMatrix(input),
    eventStream: aggregateOperationalEventStream(input),
    departmentThroughput: buildDepartmentThroughput(input),
    executionConfidence: computeExecutionConfidence(risks, open.length),
  };
}
