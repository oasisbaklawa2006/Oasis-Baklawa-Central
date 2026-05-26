import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isDispatchPanicOrder, isDispatchPipelineOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "dispatchQueueFeed:orders.dispatch";

export function buildDispatchQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter((o) => isDispatchPanicOrder(o) || isDispatchPipelineOrder(o));
  const panicCount = ctx.orders.filter(isDispatchPanicOrder).length;
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 25).map((o) => ({
    id: `dispatch:${o.id}`,
    queueId: "dispatch_queue" as const,
    title: isDispatchPanicOrder(o) ? `${soLabel(o.id)} — dispatch attention` : `${soLabel(o.id)} — dispatch pipeline`,
    summary: `Status ${o.status}${isDispatchPanicOrder(o) ? " · urgent" : ""}`,
    entityId: o.id,
    entityType: "dispatch" as const,
    blockers: isDispatchPanicOrder(o) ? [{ code: "panic", label: "Dispatch urgency flagged" }] : [],
    customerImpact: true,
    operationalSeverity: isDispatchPanicOrder(o) ? ("critical" as const) : ("medium" as const),
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  const warnings: string[] = [];
  if (panicCount > 0) warnings.push(`${panicCount} panic urgency order(s) in window`);
  if (rows.length > 25) warnings.push(`Showing 25 of ${rows.length} dispatch rows`);
  return successFeedResult(SOURCE, items, pressure, "live", warnings);
}
