import { projectCmdQueuePressure, type CmdQueuePressureProjection } from "@/lib/work-queues/cmdQueuePressure";
import type { LiveFeedResult, OperationalFeedContext } from "./feedTypes";
import { buildFinanceQueueFeed } from "./financeQueueFeed";
import { buildDispatchQueueFeed } from "./dispatchQueueFeed";
import { buildCustomerRiskQueueFeed } from "./customerRiskQueueFeed";
import { buildBlockerQueueFeed } from "./blockerQueueFeed";
import { isDispatchPanicOrder, isFinanceHoldOrder, isTriageReviewOrder } from "./orderFeedUtils";

export interface CmdPressureFeedResult extends CmdQueuePressureProjection {
  freshnessWarnings: string[];
  feedFreshness: "live" | "partial" | "unavailable";
  lastLoadedAt: string;
}

export function buildCmdPressureFeed(
  ctx: OperationalFeedContext,
  feeds?: {
    finance?: LiveFeedResult;
    dispatch?: LiveFeedResult;
    customerRisk?: LiveFeedResult;
    blocker?: LiveFeedResult;
  },
): CmdPressureFeedResult {
  const finance = feeds?.finance ?? buildFinanceQueueFeed(ctx);
  const dispatch = feeds?.dispatch ?? buildDispatchQueueFeed(ctx);
  const customerRisk = feeds?.customerRisk ?? buildCustomerRiskQueueFeed(ctx);
  const blocker = feeds?.blocker ?? buildBlockerQueueFeed(ctx);

  const financeHoldCount = finance.pressureCount ?? 0;
  const dispatchPanicCount = ctx.orders.filter(isDispatchPanicOrder).length;
  const triageReviewCount = ctx.orders.filter(isTriageReviewOrder).length;

  const projection = projectCmdQueuePressure({
    financeHoldCount: finance.pressureCount !== null ? financeHoldCount : 0,
    dispatchPanicCount: dispatch.pressureCount !== null ? dispatchPanicCount : 0,
    triageReviewCount: customerRisk.pressureCount !== null ? triageReviewCount : 0,
    scanAnomalyCount: ctx.scanAnomalyCount ?? null,
    reservationRiskCount: ctx.reservationRiskCount ?? null,
  });

  const warnings = [
    ...finance.warnings,
    ...dispatch.warnings,
    ...customerRisk.warnings,
    ...blocker.warnings,
  ];
  if (ctx.orderQueryError) warnings.unshift(`Orders: ${ctx.orderQueryError}`);
  if (ctx.factoryInventoryError) warnings.push(`factory_inventory: ${ctx.factoryInventoryError}`);

  let feedFreshness: CmdPressureFeedResult["feedFreshness"] = "live";
  if (ctx.orderQueryError) feedFreshness = "unavailable";
  else if (finance.freshness === "partial" || dispatch.freshness === "partial") feedFreshness = "partial";

  return {
    ...projection,
    unifiedRootBlocker: blocker.items[0]?.title?.replace("Root blocker — ", "") ?? projection.unifiedRootBlocker,
    unifiedBlockerContext: blocker.items[0]?.summary ?? projection.unifiedBlockerContext,
    freshnessWarnings: [...new Set(warnings)],
    feedFreshness,
    lastLoadedAt: ctx.loadedAt,
  };
}
