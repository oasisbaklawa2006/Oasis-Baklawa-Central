import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isProductionPipelineOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "productionQueueFeed:orders.production_pipeline";

export function buildProductionQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter(isProductionPipelineOrder);
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 25).map((o) => ({
    id: `production:${o.id}`,
    queueId: "production_queue" as const,
    title: `${soLabel(o.id)} — production`,
    summary: `Status ${o.status}`,
    entityId: o.id,
    entityType: "factory_followup" as const,
    customerImpact: true,
    operationalSeverity: "medium" as const,
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  return successFeedResult(
    SOURCE,
    items,
    pressure,
    "live",
    rows.length > 25 ? [`Showing 25 of ${rows.length} production pipeline orders`] : [],
  );
}
