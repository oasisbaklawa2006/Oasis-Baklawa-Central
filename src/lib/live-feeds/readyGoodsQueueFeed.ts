import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, isReadyGoodsPipelineOrder, soLabel } from "./orderFeedUtils";

const SOURCE = "readyGoodsQueueFeed:orders.packed_ready";

export function buildReadyGoodsQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter(isReadyGoodsPipelineOrder);
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 25).map((o) => ({
    id: `ready:${o.id}`,
    queueId: "retail_followup_queue" as const,
    title: `${soLabel(o.id)} — ready goods`,
    summary: "Packed ready — shelf verification may still be required",
    entityId: o.id,
    entityType: "inventory_snapshot" as const,
    customerImpact: true,
    operationalSeverity: "low" as const,
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  const warnings = ["Shelf-level truth not wired — manual verification until outlet feed lands"];
  if (rows.length > 25) warnings.push(`Showing 25 of ${rows.length} ready goods orders`);
  return successFeedResult(SOURCE, items, pressure, ctx.factoryInventoryError ? "partial" : "live", warnings);
}
