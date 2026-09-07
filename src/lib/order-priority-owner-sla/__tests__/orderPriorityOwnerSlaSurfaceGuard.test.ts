import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

const ORDER_POOL_SURFACES = [
  "src/pages/admin/CMDWarRoom.tsx",
  "src/pages/admin/OrderManagement.tsx",
  "src/pages/admin/AdminOperations.tsx",
  "src/pages/admin/FinanceReleaseBoard.tsx",
  "src/pages/sales/SalesDashboard.tsx",
  "src/pages/admin/LiveWorkQueues.tsx",
  "src/components/admin/OrderLocatorPanel.tsx",
  "src/hooks/useOperationalLiveFeeds.ts",
  "src/lib/live-feeds/orderFeedUtils.ts",
];

describe("Point74 order priority / owner / SLA surface census guards", () => {
  it("establishes a single canonical read/action module boundary", () => {
    const index = source("src/lib/order-priority-owner-sla/index.ts");
    expect(index).toContain("orderPriorityOwnerSlaClient");
    expect(index).toContain("orderPriorityOwnerSlaActions");
    expect(index).toContain("orderPriorityOwnerSlaProjection");
  });

  it("fail-closes reassignment and priority override mutations", () => {
    const actions = source("src/lib/order-priority-owner-sla/orderPriorityOwnerSlaActions.ts");
    const types = source("src/lib/order-priority-owner-sla/orderPriorityOwnerSlaTypes.ts");
    expect(types).toContain("reassign_order_owner_v1");
    expect(types).toContain("override_order_priority_v1");
    expect(actions).toContain("OrderPriorityOwnerSlaActionBlockedError");
    expect(actions).toContain("CORE_PREREQUISITE_REASSIGN_ORDER_OWNER_V1");
  });

  it("CMD War Room consumes canonical queue ordering instead of inline panic sort", () => {
    const warRoom = source("src/pages/admin/CMDWarRoom.tsx");
    expect(warRoom).toContain("compareOrderPoolQueueItems");
    expect(warRoom).toContain("projectFromRawFacts");
    expect(warRoom).not.toMatch(/\.sort\(\(a, b\) => \{[\s\S]*dispatch_urgency === "panic"/);
  });

  it("live feed panic detection routes through canonical projection helper", () => {
    const feedUtils = source("src/lib/live-feeds/orderFeedUtils.ts");
    expect(feedUtils).toContain("isDispatchPanicFromUrgency");
    expect(feedUtils).not.toMatch(/dispatch_urgency === "panic"/);
  });

  it("flags CRM-lite overdue tasks as non-order-authority (not Point74)", () => {
    const salesDashboard = source("src/pages/sales/SalesDashboard.tsx");
    expect(salesDashboard).toContain('from("crm_tasks")');
    expect(salesDashboard).not.toContain("order-priority-owner-sla");
  });

  it("documents client-invented priority surfaces still pending migration", () => {
    const workQueues = source("src/lib/work-queues/queueProjection.ts");
    expect(workQueues).toContain("computeQueueItemScore");
    const productionJobs = source("src/integrations/supabase/database.types.ts");
    expect(productionJobs).toContain("production_jobs");
  });

  for (const surface of ORDER_POOL_SURFACES) {
    it(`census includes ${surface}`, () => {
      expect(source(surface).length).toBeGreaterThan(0);
    });
  }
});
