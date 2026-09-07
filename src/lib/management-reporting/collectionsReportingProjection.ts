import { differenceInDays, parseISO } from "date-fns";
import type {
  CollectionsAgeingBucket,
  CollectionsReportingSnapshot,
  RankedEntity,
} from "./managementReportingTypes";
import {
  resolveFinanceMetric,
  wrapObservedMetric,
  wrapUnavailableMetric,
} from "./coreFinance255Adapter";
import type { CompanyFactRow, OrderFactRow } from "./operationalMetricsProjection";

export interface CompanyCreditFactRow extends CompanyFactRow {
  wallet_balance: number | null;
  credit_limit: number | null;
  allow_credit: boolean | null;
  is_frozen: boolean | null;
}

const AGEING_BUCKETS: CollectionsAgeingBucket["bucket"][] = ["0-30", "31-60", "61-90", "90+"];

function outstandingAmount(order: OrderFactRow): number {
  return Math.max(0, (order.sales_order_value ?? 0) - (order.advance_paid ?? 0));
}

function bucketForAgeDays(days: number): CollectionsAgeingBucket["bucket"] {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function buildCollectionsReportingSnapshot(input: {
  orders: OrderFactRow[];
  companies: CompanyCreditFactRow[];
  disputedOrHeldAmount: number;
  periodStartIso: string;
  periodEndIso: string;
  referenceDate?: Date;
}): CollectionsReportingSnapshot {
  const ref = input.referenceDate ?? new Date();
  const unpaidOrders = input.orders.filter(
    (o) => o.payment_status !== "paid" && !["draft", "cart", "cancelled"].includes(o.status),
  );

  const recoverableOutstanding = unpaidOrders.reduce((s, o) => s + outstandingAmount(o), 0);

  const periodStart = parseISO(input.periodStartIso);
  const periodEnd = parseISO(input.periodEndIso);
  const recoveredInPeriod = input.orders
    .filter((o) => {
      if (o.payment_status !== "paid" || !o.created_at) return false;
      const created = parseISO(o.created_at);
      return created >= periodStart && created <= periodEnd;
    })
    .reduce((s, o) => s + (o.sales_order_value ?? 0), 0);

  const walletExposure = input.companies.reduce(
    (s, c) => s + Math.max(0, -(c.wallet_balance ?? 0)),
    0,
  );
  const creditExposure = input.companies
    .filter((c) => c.allow_credit && !c.is_frozen)
    .reduce((s, c) => s + (c.credit_limit ?? 0), 0);

  const ageingMap = new Map<CollectionsAgeingBucket["bucket"], CollectionsAgeingBucket>();
  for (const bucket of AGEING_BUCKETS) {
    ageingMap.set(bucket, { bucket, orderCount: 0, outstandingAmount: 0 });
  }
  for (const order of unpaidOrders) {
    if (!order.created_at) continue;
    const days = differenceInDays(ref, parseISO(order.created_at));
    const bucket = bucketForAgeDays(Math.max(0, days));
    const entry = ageingMap.get(bucket)!;
    entry.orderCount += 1;
    entry.outstandingAmount += outstandingAmount(order);
  }

  const companyName = new Map(input.companies.map((c) => [c.id, c.business_name ?? c.id.slice(0, 8)]));
  const exposureByCompany = new Map<string, number>();
  for (const order of unpaidOrders) {
    if (!order.company_id) continue;
    exposureByCompany.set(
      order.company_id,
      (exposureByCompany.get(order.company_id) ?? 0) + outstandingAmount(order),
    );
  }
  const topExposureClients: RankedEntity[] = [...exposureByCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, metric]) => ({
      id,
      label: companyName.get(id) ?? id.slice(0, 8),
      metric,
      secondaryLabel: "outstanding",
      drillRoute: `/admin/clients/${encodeURIComponent(id)}`,
    }));

  return {
    asOfIso: ref.toISOString(),
    recoverableOutstanding: resolveFinanceMetric(
      "recoverable_vs_recovered_macro",
      recoverableOutstanding,
      "orders.payment_status!=paid outstanding gap",
    ),
    recoveredInPeriod: wrapObservedMetric(
      recoveredInPeriod,
      "orders.payment_status=paid in selected period",
    ),
    disputedOrHeld: wrapObservedMetric(
      input.disputedOrHeldAmount,
      "ledger_disputes + finance holds (Central observed)",
    ),
    walletExposure: resolveFinanceMetric(
      "credit_exposure_macro",
      walletExposure,
      "companies.wallet_balance negative aggregate",
    ),
    creditExposure: resolveFinanceMetric(
      "credit_exposure_macro",
      creditExposure,
      "companies.credit_limit where allow_credit",
    ),
    ageingBuckets: AGEING_BUCKETS.map((b) => ageingMap.get(b)!),
    topExposureClients,
  };
}

export function buildProfitabilityMetric(unavailable = true) {
  if (unavailable) {
    return wrapUnavailableMetric(
      0,
      "core:#255/get_finance_profitability_facts_v1",
      "Core #255 profitability contract not production-certified",
    );
  }
  return wrapObservedMetric(0, "core:#255/get_finance_profitability_facts_v1");
}
