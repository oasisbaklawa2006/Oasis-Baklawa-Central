import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isDispatchPanicOrder, isFinanceHoldOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "escalationQueueFeed:orders.escalation_proxy";

export function buildEscalationQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter((o) => isDispatchPanicOrder(o) || (isFinanceHoldOrder(o) && (agingHoursFromCreatedAt(o.created_at) ?? 0) >= 24));
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 20).map((o) => ({
    id: `esc:${o.id}`,
    queueId: "governance_review_queue" as const,
    title: `${soLabel(o.id)} — escalation review`,
    summary: "Advisory escalation topic — no auto-escalation jobs",
    entityId: o.id,
    entityType: "approval_request" as const,
    customerImpact: true,
    operationalSeverity: isDispatchPanicOrder(o) ? ("critical" as const) : ("high" as const),
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  return successFeedResult(SOURCE, items, pressure, "live", ["Derived escalation topics only — not a persisted ticket queue"]);
}
