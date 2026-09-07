import {
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
} from "date-fns";
import type {
  ComparisonWindow,
  DelayRiskSnapshot,
  OperationalPositionSnapshot,
  RankedEntity,
} from "./managementReportingTypes";
import { wrapObservedMetric } from "./coreFinance255Adapter";

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
): OperationalPositionSnapshot {
  const actionable = filterActionableOrders(orders);
  const asOfIso = referenceDate.toISOString();

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
  slaBreachedSupportCount: number;
  disputedLedgerCount: number;
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
