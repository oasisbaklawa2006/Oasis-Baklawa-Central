import { differenceInDays, parseISO } from "date-fns";
import type {
  CollectionsAgeingBucket,
  CollectionsReportingSnapshot,
  CreditRiskSnapshot,
  RankedEntity,
} from "./managementReportingTypes";
import {
  wrapObservedMetric,
  wrapUnavailableMetric,
  coreFinance255Source,
} from "./coreFinance255Adapter";
import type { CoreFinance255CollectionsSnapshot } from "./coreFinance255ReadClient";
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
  disputedOrHeldUnavailable?: boolean;
  disputedOrHeldBlocker?: string;
  ordersTruncated?: boolean;
  companiesTruncated?: boolean;
  disputesTruncated?: boolean;
  periodStartIso: string;
  periodEndIso: string;
  referenceDate?: Date;
  coreFinance255?: CoreFinance255CollectionsSnapshot | null;
}): CollectionsReportingSnapshot {
  const ref = input.referenceDate ?? new Date();
  const unpaidOrders = input.orders.filter(
    (o) => o.payment_status !== "paid" && !["draft", "cart", "cancelled"].includes(o.status),
  );

  const tableRecoverable = unpaidOrders.reduce((s, o) => s + outstandingAmount(o), 0);
  const core = input.coreFinance255;
  const recoverableOutstanding = buildRecoverableOutstandingMetric({
    core,
    tableRecoverable,
    ordersTruncated: input.ordersTruncated ?? false,
  });
  const recoveredInPeriod = buildRecoveredInPeriodMetric(core);

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

  const creditRisk: CreditRiskSnapshot = {
    frozenAccountCount: input.companies.filter((c) => c.is_frozen).length,
    negativeWalletCount: input.companies.filter((c) => (c.wallet_balance ?? 0) < 0).length,
    creditEnabledCount: input.companies.filter((c) => c.allow_credit && !c.is_frozen).length,
    highExposureCount: topExposureClients.filter((c) => c.metric > 0).length,
  };

  return {
    asOfIso: ref.toISOString(),
    recoverableOutstanding,
    recoveredInPeriod,
    disputedOrHeld:
      input.disputedOrHeldUnavailable || input.disputesTruncated
        ? wrapUnavailableMetric(
            0,
            "ledger_disputes + finance holds (Central observed)",
            input.disputedOrHeldBlocker ??
              (input.disputesTruncated
                ? "ledger_disputes read truncated — partial dataset"
                : "ledger_disputes read failed"),
          )
        : wrapObservedMetric(
            input.disputedOrHeldAmount,
            "ledger_disputes + finance holds (Central observed)",
          ),
    walletExposure: input.companiesTruncated
      ? wrapUnavailableMetric(
          0,
          "companies.wallet_balance negative aggregate (Central table)",
          "companies read truncated — partial dataset",
        )
      : wrapObservedMetric(
          walletExposure,
          "companies.wallet_balance negative aggregate (Central table)",
        ),
    creditExposure: input.companiesTruncated
      ? wrapUnavailableMetric(
          0,
          "companies.credit_limit where allow_credit (Central table; per-order Core via get_credit_exposure_facts_v1)",
          "companies read truncated — partial dataset",
        )
      : wrapObservedMetric(
          creditExposure,
          "companies.credit_limit where allow_credit (Central table; per-order Core via get_credit_exposure_facts_v1)",
        ),
    profitability: buildProfitabilityMetric(),
    ageingBuckets: input.ordersTruncated ? [] : AGEING_BUCKETS.map((b) => ageingMap.get(b)!),
    ageingSource: input.ordersTruncated
      ? "Unavailable — orders read truncated; ageing requires complete unpaid order set"
      : "Central order.created_at aggregate — portfolio-level ageing macro RPC unavailable on Core #255",
    topExposureClients,
    creditRisk,
  };
}

export function buildProfitabilityMetric() {
  return wrapUnavailableMetric(
    0,
    coreFinance255Source("get_finance_profitability_facts_v1"),
    "No profitability macro RPC deployed on Core #255",
  );
}

function buildRecoverableOutstandingMetric(input: {
  core: CoreFinance255CollectionsSnapshot | null | undefined;
  tableRecoverable: number;
  ordersTruncated: boolean;
}) {
  const { core, tableRecoverable, ordersTruncated } = input;
  if (core?.unpaidLookupBounded) {
    return wrapUnavailableMetric(
      0,
      coreFinance255Source("get_order_payment_facts_v1"),
      `Core payment facts bounded to ${core.ordersAttempted} of unpaid orders — incomplete scan`,
    );
  }
  if (ordersTruncated) {
    return wrapUnavailableMetric(
      0,
      "orders.payment_status!=paid outstanding gap (Central table aggregate)",
      "orders read truncated — partial dataset",
    );
  }
  if (core && core.ordersWithCoreFacts > 0) {
    return wrapObservedMetric(
      core.recoverableOutstanding,
      `${core.source} (${core.ordersWithCoreFacts}/${core.ordersAttempted} orders with governed PI)`,
    );
  }
  return wrapObservedMetric(
    tableRecoverable,
    "orders.payment_status!=paid outstanding gap (Central table aggregate)",
  );
}

function buildRecoveredInPeriodMetric(core: CoreFinance255CollectionsSnapshot | null | undefined) {
  if (core?.recoveredInPeriodAvailable) {
    return wrapObservedMetric(
      core.recoveredInPeriod,
      `${core.source} (verified_at within selected period; ${core.recoveryOrdersWithFacts}/${core.recoveryOrdersAttempted} orders)`,
    );
  }
  return wrapUnavailableMetric(
    0,
    coreFinance255Source("get_order_payment_facts_v1"),
    core?.recoveredInPeriodBlocker ??
      "Recovered-in-period requires timestamped payment facts from get_order_payment_facts_v1",
  );
}
