import { describe, expect, it } from "vitest";
import { buildQueueItem, projectWorkQueues } from "../queueProjection";
import { sortQueueItems, computeQueueItemScore } from "../queuePriority";
import { interpretQueueReadiness } from "../queueReadiness";
import { projectCmdQueuePressure } from "../cmdQueuePressure";

describe("work queues", () => {
  it("builds queue item with blockers and dependency state", () => {
    const item = buildQueueItem({
      id: "q1",
      queueId: "finance_review_queue",
      title: "Finance review",
      entityId: "e1",
      blockers: [{ code: "finance", label: "Finance pending", isRoot: true }],
      customerImpact: true,
      upstreamSatisfied: false,
      upstreamLabel: "finance",
      downstreamLabel: "production",
    });
    expect(item.readiness.state).toBe("blocked");
    expect(item.dependency.state).toBe("blocked");
    expect(item.customerImpact).toBe(true);
  });

  it("sorts by priority score descending", () => {
    const low = buildQueueItem({
      id: "l",
      queueId: "production_queue",
      title: "Low",
      entityId: "e1",
      operationalSeverity: "low",
    });
    const high = buildQueueItem({
      id: "h",
      queueId: "dispatch_queue",
      title: "High",
      entityId: "e2",
      operationalSeverity: "critical",
      customerImpact: true,
    });
    const sorted = sortQueueItems([low, high]);
    expect(sorted[0].id).toBe("h");
  });

  it("returns pending pressure when no items connected", () => {
    const snapshots = projectWorkQueues({
      pressureByQueue: { finance_review_queue: null },
    });
    const finance = snapshots.find((s) => s.queueId === "finance_review_queue");
    expect(finance?.pressureCount).toBeNull();
  });

  it("never derives pressureCount from item count without explicit pressureByQueue", () => {
    const snapshots = projectWorkQueues({
      itemsByQueue: {
        finance_review_queue: [
          { id: "a", queueId: "finance_review_queue", title: "A", entityId: "o1" },
          { id: "b", queueId: "finance_review_queue", title: "B", entityId: "o2" },
        ],
      },
    });
    const finance = snapshots.find((s) => s.queueId === "finance_review_queue");
    expect(finance?.items).toHaveLength(2);
    expect(finance?.pressureCount).toBeNull();
  });

  it("interprets readiness semantics", () => {
    const item = buildQueueItem({
      id: "x",
      queueId: "assembly_queue",
      title: "Assembly",
      entityId: "e1",
    });
    expect(interpretQueueReadiness(item.readiness)).toBe("actionable");
  });

  it("projects CMD queue pressure from explicit counts only", () => {
    const p = projectCmdQueuePressure({
      financeHoldCount: 3,
      dispatchPanicCount: 1,
      triageReviewCount: 2,
      scanAnomalyCount: null,
      reservationRiskCount: null,
    });
    expect(p.customerRiskQueuePressure).toBe(6);
    expect(p.unifiedRootBlocker).toBeTruthy();
    expect(p.financeToDispatchRisk).toBe(true);
    expect(p.scanExceptionPressure).toBeNull();
  });

  it("computes higher score for critical customer impact", () => {
    const score = computeQueueItemScore({
      priority: "urgent",
      operationalSeverity: "critical",
      customerImpact: true,
      blockerCount: 2,
      agingHours: 48,
    });
    expect(score).toBeGreaterThan(75);
  });
});
