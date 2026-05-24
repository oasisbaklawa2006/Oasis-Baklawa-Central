import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import {
  agingHoursFromCreatedAt,
  isDispatchPanicOrder,
  isFinanceHoldOrder,
  isTriageReviewOrder,
  soLabel,
} from "./orderFeedUtils";

const SOURCE = "customerRiskQueueFeed:orders.customer_impact";

export function buildCustomerRiskQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter(
    (o) => isFinanceHoldOrder(o) || isDispatchPanicOrder(o) || isTriageReviewOrder(o) || o.has_complaint,
  );
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 25).map((o) => ({
    id: `risk:${o.id}`,
    queueId: "customer_support_queue" as const,
    title: `${soLabel(o.id)} — customer impact`,
    summary: o.has_complaint ? "Open support ticket" : "Operational attention required",
    entityId: o.id,
    entityType: "order" as const,
    customerImpact: true,
    operationalSeverity: isDispatchPanicOrder(o) ? ("critical" as const) : ("high" as const),
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  return successFeedResult(
    SOURCE,
    items,
    pressure,
    "live",
    rows.length > 25 ? [`Showing 25 of ${rows.length} customer-risk orders`] : [],
  );
}
