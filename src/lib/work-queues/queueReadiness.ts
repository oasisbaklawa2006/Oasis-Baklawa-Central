import type { EntityReadinessProjection } from "@/lib/entity-graph/entityReadiness";
import { blockedReadiness, pendingReadiness, readyReadiness } from "@/lib/entity-graph/entityReadiness";
import type { QueueBlocker } from "./queueTypes";

export function queueReadinessFromBlockers(blockers: QueueBlocker[]): EntityReadinessProjection {
  if (blockers.length === 0) return readyReadiness();
  const root = blockers.find((b) => b.isRoot) ?? blockers[0];
  if (root.isRoot) {
    return blockedReadiness(
      blockers.map((b) => ({
        code: b.code,
        label: b.label,
      })),
    );
  }
  return pendingReadiness(blockers.map((b) => b.label).join("; "));
}

export type QueueReadinessSemantics = "actionable" | "waiting_upstream" | "blocked" | "not_connected";

export function interpretQueueReadiness(readiness: EntityReadinessProjection): QueueReadinessSemantics {
  switch (readiness.state) {
    case "ready":
      return "actionable";
    case "pending":
      return "waiting_upstream";
    case "blocked":
      return "blocked";
    case "not_applicable":
    default:
      return "not_connected";
  }
}
