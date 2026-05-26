import type { WorkQueueId } from "@/lib/work-queues/queueTypes";
import { projectWorkQueues } from "@/lib/work-queues/queueProjection";
import type { WorkQueueSnapshot } from "@/lib/work-queues/queueTypes";
import { WORK_QUEUE_IDS } from "@/lib/work-queues/queueTypes";
import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { buildFinanceQueueFeed } from "./financeQueueFeed";
import { buildDispatchQueueFeed } from "./dispatchQueueFeed";
import { buildProductionQueueFeed } from "./productionQueueFeed";
import { buildAssemblyQueueFeed } from "./assemblyQueueFeed";
import { buildReadyGoodsQueueFeed } from "./readyGoodsQueueFeed";
import { buildThirdPartyQueueFeed } from "./thirdPartyQueueFeed";
import { buildCustomerRiskQueueFeed } from "./customerRiskQueueFeed";
import { buildEscalationQueueFeed } from "./escalationQueueFeed";
import { buildBlockerQueueFeed } from "./blockerQueueFeed";
import { buildCmdPressureFeed, type CmdPressureFeedResult } from "./cmdPressureFeed";

export interface AggregatedLiveFeeds {
  byQueue: Record<WorkQueueId, LiveFeedResult>;
  snapshots: WorkQueueSnapshot[];
  cmdPressure: CmdPressureFeedResult;
  allWarnings: string[];
}

const QUEUE_FEED_BUILDERS: Partial<Record<WorkQueueId, (ctx: OperationalFeedContext) => LiveFeedResult>> = {
  finance_review_queue: buildFinanceQueueFeed,
  production_queue: buildProductionQueueFeed,
  assembly_queue: buildAssemblyQueueFeed,
  dispatch_queue: buildDispatchQueueFeed,
  retail_followup_queue: (ctx) => {
    const ready = buildReadyGoodsQueueFeed(ctx);
    const third = buildThirdPartyQueueFeed(ctx);
    const mergedItems = [...ready.items, ...third.items.filter((t) => !ready.items.some((r) => r.entityId === t.entityId))];
    const pressure =
      ready.pressureCount !== null || third.pressureCount !== null
        ? (ready.pressureCount ?? 0) + (third.pressureCount ?? 0)
        : null;
    return {
      items: mergedItems.slice(0, 30),
      pressureCount: pressure && pressure > 0 ? pressure : null,
      freshness: ready.freshness === "unavailable" && third.freshness === "unavailable" ? "unavailable" : "partial",
      source: "aggregate:retail_followup",
      warnings: [...ready.warnings, ...third.warnings],
      lastLoadedAt: ctx.loadedAt,
    };
  },
  reservation_verification_queue: (ctx) => ({
    items: [],
    pressureCount: ctx.reservationRiskCount ?? null,
    freshness: ctx.reservationRiskCount === null ? "unavailable" : "live",
    source: "reservation:pending_feed",
    warnings: ctx.reservationRiskCount === null ? ["Reservation verification feed not connected"] : [],
    lastLoadedAt: ctx.loadedAt,
  }),
  governance_review_queue: buildEscalationQueueFeed,
  inventory_verification_queue: (ctx) => ({
    items: [],
    pressureCount: ctx.factoryInventoryCount ?? null,
    freshness: ctx.factoryInventoryError ? "unavailable" : ctx.factoryInventoryCount !== null ? "partial" : "unavailable",
    source: "factory_inventory:head_count",
    warnings: ctx.factoryInventoryError
      ? [ctx.factoryInventoryError]
      : ["Head count only — not shelf-level verification"],
    lastLoadedAt: ctx.loadedAt,
  }),
  scan_exception_queue: (ctx) => ({
    items: [],
    pressureCount: ctx.scanAnomalyCount ?? null,
    freshness: ctx.scanAnomalyCount === null ? "unavailable" : "live",
    source: "scan:pending_feed",
    warnings: ctx.scanAnomalyCount === null ? ["Scan exception store not connected"] : [],
    lastLoadedAt: ctx.loadedAt,
  }),
  customer_support_queue: buildCustomerRiskQueueFeed,
};

export function aggregateLiveFeeds(ctx: OperationalFeedContext): AggregatedLiveFeeds {
  const finance = buildFinanceQueueFeed(ctx);
  const dispatch = buildDispatchQueueFeed(ctx);
  const customerRisk = buildCustomerRiskQueueFeed(ctx);
  const blocker = buildBlockerQueueFeed(ctx);

  const byQueue = {} as Record<WorkQueueId, LiveFeedResult>;
  for (const queueId of WORK_QUEUE_IDS) {
    const builder = QUEUE_FEED_BUILDERS[queueId];
    byQueue[queueId] = builder ? builder(ctx) : { items: [], pressureCount: null, freshness: "unavailable", source: queueId, warnings: ["No feed builder"], lastLoadedAt: ctx.loadedAt };
  }

  const itemsByQueue = Object.fromEntries(
    WORK_QUEUE_IDS.map((id) => [id, byQueue[id].items]),
  ) as Partial<Record<WorkQueueId, typeof finance.items>>;

  const pressureByQueue = Object.fromEntries(
    WORK_QUEUE_IDS.map((id) => [id, byQueue[id].pressureCount]),
  ) as Partial<Record<WorkQueueId, number | null>>;

  const snapshots = projectWorkQueues({ itemsByQueue, pressureByQueue });
  const cmdPressure = buildCmdPressureFeed(ctx, { finance, dispatch, customerRisk, blocker });
  const allWarnings = [...new Set(WORK_QUEUE_IDS.flatMap((id) => byQueue[id].warnings).concat(cmdPressure.freshnessWarnings))];

  return { byQueue, snapshots, cmdPressure, allWarnings };
}
