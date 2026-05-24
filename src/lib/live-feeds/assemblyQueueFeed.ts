import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isAssemblyPipelineOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "assemblyQueueFeed:orders.assembly_pipeline";

export function buildAssemblyQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter(isAssemblyPipelineOrder);
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 25).map((o) => ({
    id: `assembly:${o.id}`,
    queueId: "assembly_queue" as const,
    title: `${soLabel(o.id)} — assembly`,
    summary: `Status ${o.status}`,
    entityId: o.id,
    entityType: "carton" as const,
    customerImpact: true,
    operationalSeverity: "medium" as const,
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  return successFeedResult(
    SOURCE,
    items,
    pressure,
    "live",
    rows.length > 25 ? [`Showing 25 of ${rows.length} assembly pipeline orders`] : [],
  );
}
