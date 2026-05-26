import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { emptyFeedResult, successFeedResult } from "./feedTypes";
import { agingHoursFromCreatedAt, soLabel } from "./orderFeedUtils";

const SOURCE = "thirdPartyQueueFeed:orders.needs_clarification";

/** Proxy: orders needing clarification often involve third-party / mapping work. */
export function buildThirdPartyQueueFeed(ctx: OperationalFeedContext): LiveFeedResult {
  if (ctx.orderQueryError) {
    return emptyFeedResult(SOURCE, `Orders read failed: ${ctx.orderQueryError}`);
  }
  const rows = ctx.orders.filter((o) => o.needs_clarification);
  const pressure = rows.length > 0 ? rows.length : null;
  const items = rows.slice(0, 15).map((o) => ({
    id: `3p:${o.id}`,
    queueId: "retail_followup_queue" as const,
    title: `${soLabel(o.id)} — clarification`,
    summary: "Order needs operational clarification",
    entityId: o.id,
    entityType: "order" as const,
    customerImpact: true,
    operationalSeverity: "medium" as const,
    agingHours: agingHoursFromCreatedAt(o.created_at),
  }));
  return successFeedResult(
    SOURCE,
    items,
    pressure,
    "partial",
    ["Third-party procurement table not wired — using needs_clarification proxy"],
  );
}
