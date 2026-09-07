import {
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
  differenceInMilliseconds,
  subMilliseconds,
} from "date-fns";
import type {
  ComparisonWindow,
  DelayRiskSnapshot,
  OperationalPositionSnapshot,
  RankedEntity,
  RankedEntityWithTrend,
} from "./managementReportingTypes";
import { wrapObservedMetric, wrapUnavailableMetric } from "./coreFinance255Adapter";

export interface OrderFactRow {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_paid: number | null;
  advance_required: number | null;
  company_id: string | null;
  created_at: string | null;
}

export interface OrderItemFactRow {
  order_id: string;
  product_id: string | null;
  quantity: number | null;
  product_name?: string | null;
}

export interface CompanyFactRow {
  id: string;
  business_name: string | null;
  account_manager_id?: string | null;
}

export interface UserFactRow {
  id: string;
  full_name: string | null;
  name: string | null;
}

const PRODUCTION_STATUSES = new Set([
  "confirmed",
  "manufacturing",
  "in_production",
  "assembled",
]);
const PACKED_STATUSES = new Set(["packing", "packed_ready"]);
const DISPATCHED_STATUSES = new Set(["dispatched", "delivered", "closed"]);
const EXCLUDED_STATUSES = new Set(["draft", "cart", "cancelled"]);

export function buildComparisonWindows(referenceDate: Date): ComparisonWindow[] {
  const todayStart = startOfDay(referenceDate);
  const todayEnd = endOfDay(referenceDate);
  return [
    {
      key: "today",
      label: "Today",
      startIso: todayStart.toISOString(),
      endIso: todayEnd.toISOString(),
    },
    {
      key: "same_day_last_week",
      label: "Same day last week",
      startIso: startOfDay(subDays(referenceDate, 7)).toISOString(),
      endIso: endOfDay(subDays(referenceDate, 7)).toISOString(),
    },
    {
      key: "same_day_last_month",
      label: "Same day last month",
      startIso: startOfDay(subMonths(referenceDate, 1)).toISOString(),
      endIso: endOfDay(subMonths(referenceDate, 1)).toISOString(),
    },
    {
      key: "same_day_last_year",
      label: "Same day last year",
      startIso: startOfDay(subYears(referenceDate, 1)).toISOString(),
      endIso: endOfDay(subYears(referenceDate, 1)).toISOString(),
    },
  ];
}

function filterActionableOrders(orders: OrderFactRow[]): OrderFactRow[] {
  return orders.filter((o) => !EXCLUDED_STATUSES.has(o.status));
}

function ordersInWindow(orders: OrderFactRow[], startIso: string, endIso: string): OrderFactRow[] {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  return orders.filter((o) => {
    if (!o.created_at) return false;
    const created = parseISO(o.created_at);
    return isWithinInterval(created, { start, end });
  });
}

export function buildOperationalPositionSnapshot(
  orders: OrderFactRow[],
  referenceDate: Date = new Date(),
  options?: { unavailable?: boolean; unavailableReason?: string },
): OperationalPositionSnapshot {
  const asOfIso = referenceDate.toISOString();
  if (options?.unavailable) {
    const blocker = options.unavailableReason ?? "Order source read truncated or incomplete";
    const source = "orders (Central table aggregate)";
    return {
      asOfIso,
      salesOrderCount: wrapUnavailableMetric(0, source, blocker),
      salesOrderValue: wrapUnavailableMetric(0, source, blocker),
      productionInFlight: wrapUnavailableMetric(0, source, blocker),
      packedAwaitingDispatch: wrapUnavailableMetric(0, source, blocker),
      dispatchedCount: wrapUnavailableMetric(0, source, blocker),
      collectionsPending: wrapUnavailableMetric(0, source, blocker),
      comparisons: [],
    };
  }

  const actionable = filterActionableOrders(orders);

  const salesOrderCount = actionable.length;
  const salesOrderValue = actionable.reduce((s, o) => s + (o.sales_order_value ?? 0), 0);
  const productionInFlight = actionable.filter((o) => PRODUCTION_STATUSES.has(o.status)).length;
  const packedAwaitingDispatch = actionable.filter((o) => PACKED_STATUSES.has(o.status)).length;
  const dispatchedCount = actionable.filter((o) => DISPATCHED_STATUSES.has(o.status)).length;
  const collectionsPending = actionable
    .filter((o) => o.payment_status !== "paid" && DISPATCHED_STATUSES.has(o.status))
    .reduce((s, o) => s + Math.max(0, (o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);

  const windows = buildComparisonWindows(referenceDate);
  const comparisons = windows.map((w) => {
    const windowOrders = ordersInWindow(actionable, w.startIso, w.endIso);
    return {
      window: w.key,
      label: w.label,
      orderCount: windowOrders.length,
      orderValue: windowOrders.reduce((s, o) => s + (o.sales_order_value ?? 0), 0),
    };
  });

  return {
    asOfIso,
    salesOrderCount: wrapObservedMetric(salesOrderCount, "orders.status!=draft|cart|cancelled"),
    salesOrderValue: wrapObservedMetric(salesOrderValue, "orders.sales_order_value"),
    productionInFlight: wrapObservedMetric(productionInFlight, "orders.status in production pipeline"),
    packedAwaitingDispatch: wrapObservedMetric(packedAwaitingDispatch, "orders.status packing|packed_ready"),
    dispatchedCount: wrapObservedMetric(dispatchedCount, "orders.status dispatched|delivered|closed"),
    collectionsPending: wrapObservedMetric(collectionsPending, "orders payment gap on dispatched legs"),
    comparisons,
  };
}

export function buildDelayRiskSnapshot(input: {
  orders: OrderFactRow[];
  slaBreachedSupportCount: number | null;
  disputedLedgerCount: number | null;
}): DelayRiskSnapshot {
  const actionable = filterActionableOrders(input.orders);
  const financeHoldCount = actionable.filter(
    (o) => (o.advance_required ?? 0) > 0 && (o.advance_paid ?? 0) < (o.advance_required ?? 0),
  ).length;
  const awaitingFinalPaymentCount = actionable.filter((o) => o.status === "awaiting_final_payment").length;
  const packedCount = actionable.filter((o) => PACKED_STATUSES.has(o.status)).length;
  const dispatchedCount = actionable.filter((o) => DISPATCHED_STATUSES.has(o.status)).length;
  const dispatchBottleneckCount =
    packedCount > 0 && packedCount > 3 * Math.max(dispatchedCount, 1) ? packedCount : 0;

  return {
    financeHoldCount,
    awaitingFinalPaymentCount,
    slaBreachedSupportCount: input.slaBreachedSupportCount,
    dispatchBottleneckCount,
    disputedLedgerCount: input.disputedLedgerCount,
  };
}

export function buildBestSellerRankings(
  orderItems: OrderItemFactRow[],
  limit = 5,
): RankedEntity[] {
  const byProduct = new Map<string, { qty: number; name: string }>();
  for (const item of orderItems) {
    if (!item.product_id) continue;
    const prev = byProduct.get(item.product_id) ?? { qty: 0, name: item.product_name ?? item.product_id.slice(0, 8) };
    prev.qty += Number(item.quantity) || 0;
    if (item.product_name) prev.name = item.product_name;
    byProduct.set(item.product_id, prev);
  }
  return [...byProduct.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, limit)
    .map(([id, { qty, name }]) => ({
      id,
      label: name,
      metric: qty,
      secondaryLabel: "units ordered",
      drillRoute: `/admin/products?highlight=${encodeURIComponent(id)}`,
    }));
}

export function buildBestClientRankings(
  orders: OrderFactRow[],
  companies: CompanyFactRow[],
  limit = 5,
): RankedEntity[] {
  const companyName = new Map(companies.map((c) => [c.id, c.business_name ?? c.id.slice(0, 8)]));
  const byCompany = new Map<string, number>();
  for (const o of filterActionableOrders(orders)) {
    if (!o.company_id) continue;
    byCompany.set(o.company_id, (byCompany.get(o.company_id) ?? 0) + (o.sales_order_value ?? 0));
  }
  return [...byCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, metric]) => ({
      id,
      label: companyName.get(id) ?? id.slice(0, 8),
      metric,
      secondaryLabel: "order value",
      drillRoute: `/admin/clients/${encodeURIComponent(id)}`,
    }));
}

export function buildBestSalespersonRankings(
  orders: OrderFactRow[],
  companies: CompanyFactRow[],
  users: UserFactRow[],
  limit = 5,
): RankedEntity[] {
  const managerByCompany = new Map(
    companies.map((c) => [c.id, c.account_manager_id ?? null]),
  );
  const userName = new Map(
    users.map((u) => [u.id, u.full_name ?? u.name ?? u.id.slice(0, 8)]),
  );
  const byUser = new Map<string, number>();
  for (const o of filterActionableOrders(orders)) {
    if (!o.company_id) continue;
    const managerId = managerByCompany.get(o.company_id);
    if (!managerId) continue;
    byUser.set(managerId, (byUser.get(managerId) ?? 0) + (o.sales_order_value ?? 0));
  }
  return [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, metric]) => ({
      id,
      label: userName.get(id) ?? id.slice(0, 8),
      metric,
      secondaryLabel: "managed order value",
      drillRoute: `/admin/sales-hub?manager=${encodeURIComponent(id)}`,
    }));
}

export function priorPeriodBounds(
  periodStartIso: string,
  periodEndIso: string,
): { startIso: string; endIso: string } {
  const start = parseISO(periodStartIso);
  const end = parseISO(periodEndIso);
  const durationMs = Math.max(0, differenceInMilliseconds(end, start));
  const priorEnd = subMilliseconds(start, 1);
  const priorStart = subMilliseconds(priorEnd, durationMs);
  return { startIso: priorStart.toISOString(), endIso: priorEnd.toISOString() };
}

function orderIdsInWindow(
  orders: OrderFactRow[],
  startIso: string,
  endIso: string,
): Set<string> {
  return new Set(ordersInWindow(filterActionableOrders(orders), startIso, endIso).map((o) => o.id));
}

function filterOrderItemsByOrderIds(
  orderItems: OrderItemFactRow[],
  orderIds: Set<string>,
): OrderItemFactRow[] {
  return orderItems.filter((item) => orderIds.has(item.order_id));
}

export function buildRankedEntityTrends(
  current: RankedEntity[],
  prior: RankedEntity[],
): RankedEntityWithTrend[] {
  const priorMap = new Map(prior.map((p) => [p.id, p.metric]));
  return current.map((c) => {
    const priorMetric = priorMap.get(c.id) ?? 0;
    const trendDelta = c.metric - priorMetric;
    const trendPercent = priorMetric > 0 ? (trendDelta / priorMetric) * 100 : null;
    return { ...c, priorMetric, trendDelta, trendPercent };
  });
}

export function buildPeriodRankingsWithTrends(input: {
  orders: OrderFactRow[];
  orderItems: OrderItemFactRow[];
  companies: CompanyFactRow[];
  users: UserFactRow[];
  periodStartIso: string;
  periodEndIso: string;
  limit?: number;
}): {
  bestSellers: RankedEntityWithTrend[];
  bestClients: RankedEntityWithTrend[];
  bestSalespeople: RankedEntityWithTrend[];
} {
  const limit = input.limit ?? 5;
  const prior = priorPeriodBounds(input.periodStartIso, input.periodEndIso);
  const currentOrderIds = orderIdsInWindow(input.orders, input.periodStartIso, input.periodEndIso);
  const priorOrderIds = orderIdsInWindow(input.orders, prior.startIso, prior.endIso);
  const currentOrders = input.orders.filter((o) => currentOrderIds.has(o.id));
  const priorOrders = input.orders.filter((o) => priorOrderIds.has(o.id));
  const currentItems = filterOrderItemsByOrderIds(input.orderItems, currentOrderIds);
  const priorItems = filterOrderItemsByOrderIds(input.orderItems, priorOrderIds);

  const priorLookupLimit = Number.MAX_SAFE_INTEGER;

  return {
    bestSellers: buildRankedEntityTrends(
      buildBestSellerRankings(currentItems, limit),
      buildBestSellerRankings(priorItems, priorLookupLimit),
    ),
    bestClients: buildRankedEntityTrends(
      buildBestClientRankings(currentOrders, input.companies, limit),
      buildBestClientRankings(priorOrders, input.companies, priorLookupLimit),
    ),
    bestSalespeople: buildRankedEntityTrends(
      buildBestSalespersonRankings(currentOrders, input.companies, input.users, limit),
      buildBestSalespersonRankings(priorOrders, input.companies, input.users, priorLookupLimit),
    ),
  };
}
