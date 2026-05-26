import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isFinanceHoldOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "financeQueueFeed:orders.finance_hold";

export function buildFinanceQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const held = ctx.orders.filter(isFinanceHoldOrder);
  const pressure = held.length > 0 ? held.length : null;
  const items = held.slice(0, 25).map((o) => ({
    id: `finance:${o.id}`,
    queueId: "finance_review_queue" as const,
    title: `${soLabel(o.id)} — finance verification`,
    summary: `Status ${o.status} · payment ${o.payment_status ?? "—"}`,
    entityId: o.id,
    entityType: "order" as const,
    blockers: [{ code: "finance", label: "Finance verification pending", isRoot: true }],
    customerImpact: true,
    operationalSeverity: "high" as const,
    agingHours: agingHoursFromCreatedAt(o.created_at),
    upstreamSatisfied: false,
    upstreamLabel: "finance",
    downstreamLabel: "production",
  }));
  return successFeedResult(SOURCE, items, pressure, "live", held.length > 25 ? [`Showing 25 of ${held.length} finance-hold orders`] : []);
}
