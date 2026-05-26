import { resolveOperationalDependencies } from "@/lib/dependency-graph/dependencyResolution";
import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { isFinanceHoldOrder } from "./orderFeedUtils";

const SOURCE = "blockerQueueFeed:dependency_graph";

export function buildBlockerQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const financeBlocked = ctx.orders.some(isFinanceHoldOrder);
  const resolution = resolveOperationalDependencies({
    finance: !financeBlocked,
    production: !financeBlocked,
    assembly: false,
    dispatch: false,
    scan: false,
    invoice: !financeBlocked,
    shipment: false,
    reservation: false,
    inventory_verification: false,
  });
  const root = resolution.rootBlocker;
  if (!root) {
    return successFeedResult(SOURCE, [], null, "live", ["No dependency blockers in current window"]);
  }
  const items = [
    {
      id: `blocker:${root.lane}`,
      queueId: "governance_review_queue" as const,
      title: `Root blocker — ${root.label}`,
      summary: resolution.escalationRecommendation,
      entityId: root.lane,
      entityType: "approval_request" as const,
      blockers: [{ code: root.lane, label: root.label, isRoot: true }],
      customerImpact: resolution.customerImpact,
      operationalSeverity: resolution.operationalSeverity,
    },
  ];
  return successFeedResult(SOURCE, items, 1, "live", resolution.downstreamImpact);
}
