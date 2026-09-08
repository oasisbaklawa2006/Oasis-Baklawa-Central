/** Metric provenance semantics — observed facts vs forecast vs blocked upstream. */
export type MetricSemantics = "observed" | "forecast" | "unavailable";

export interface GovernedMetric<T = number> {
  value: T;
  semantics: MetricSemantics;
  source: string;
  blocker?: string;
}

/** Array/object breakdown with explicit availability — never infer unavailable from empty data. */
export interface GovernedBreakdown<T> {
  semantics: MetricSemantics;
  source: string;
  blocker?: string;
  items: T;
}

export interface OperationalComparisonRow {
  window: ComparisonWindow["key"];
  label: string;
  orderCount: number;
  orderValue: number;
}

export interface ComparisonWindow {
  key: "today" | "same_day_last_week" | "same_day_last_month" | "same_day_last_year";
  label: string;
  startIso: string;
  endIso: string;
}

export interface OperationalPositionSnapshot {
  asOfIso: string;
  salesOrderCount: GovernedMetric;
  salesOrderValue: GovernedMetric;
  productionInFlight: GovernedMetric;
  packedAwaitingDispatch: GovernedMetric;
  dispatchedCount: GovernedMetric;
  collectionsPending: GovernedMetric;
  comparisons: GovernedBreakdown<OperationalComparisonRow[]>;
}

export interface RankedEntity {
  id: string;
  label: string;
  metric: number;
  secondaryLabel?: string;
  drillRoute?: string;
}

/** Period-over-period trend vs prior window of equal length. */
export interface RankedEntityWithTrend extends RankedEntity {
  priorMetric: number;
  trendDelta: number;
  trendPercent: number | null;
}

export interface DelayRiskSnapshot {
  orderDerivedSemantics: MetricSemantics;
  orderDerivedBlocker?: string;
  financeHoldCount: number | null;
  awaitingFinalPaymentCount: number | null;
  dispatchBottleneckCount: number | null;
  slaBreachedSupportCount: number | null;
  slaBreachedSemantics: MetricSemantics;
  slaBreachedBlocker?: string;
  disputedLedgerCount: number | null;
  disputedLedgerSemantics: MetricSemantics;
  disputedLedgerBlocker?: string;
}

export interface CreditRiskSnapshot {
  semantics: MetricSemantics;
  source: string;
  blocker?: string;
  frozenAccountCount: number | null;
  negativeWalletCount: number | null;
  creditEnabledCount: number | null;
  highExposureCount: number | null;
}

export interface CollectionsAgeingBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  orderCount: number;
  outstandingAmount: number;
}

export interface CollectionsReportingSnapshot {
  asOfIso: string;
  recoverableOutstanding: GovernedMetric;
  recoveredInPeriod: GovernedMetric;
  disputedOrHeld: GovernedMetric;
  walletExposure: GovernedMetric;
  creditExposure: GovernedMetric;
  profitability: GovernedMetric;
  ageingBuckets: GovernedBreakdown<CollectionsAgeingBucket[]>;
  ageingSource: string;
  topExposureClients: GovernedBreakdown<RankedEntity[]>;
  creditRisk: CreditRiskSnapshot;
}

export interface EanRegistryEntry {
  productId: string;
  productName: string;
  ean: string | null;
  sku: string | null;
  isDuplicate: boolean;
  duplicateOfProductIds: string[];
  complianceScore: number;
  missingFields: string[];
  drillRoute: string;
}

export interface ComplianceException {
  id: string;
  entityType: "product" | "company";
  entityId: string;
  entityLabel: string;
  category: "ean" | "fssai" | "label" | "hsn_gst" | "nutrition";
  severity: "critical" | "high" | "medium";
  message: string;
  drillRoute: string;
}

export interface TallyExportAuditMetadata {
  exportId: string;
  generatedAtIso: string;
  periodStart: string;
  periodEnd: string;
  companyId: string | null;
  orderCount: number;
  lineCount: number;
  contentHash: string;
  source: "tally_period_export_v2";
}

export interface ManagementCommandCenterProjection {
  asOfIso: string;
  operational: OperationalPositionSnapshot;
  rankings: {
    bestSellers: RankedEntityWithTrend[];
    bestClients: RankedEntityWithTrend[];
    bestSalespeople: RankedEntityWithTrend[];
  };
  rankingPeriodLabel: string;
  delayRisk: DelayRiskSnapshot;
  collections: CollectionsReportingSnapshot | null;
  finance255Blockers: string[];
  finance255AvailableContracts: string[];
  finance255ProductionAnchor: string;
  coreFinanceWarnings: string[];
  sourceReadWarnings: string[];
  rankingsUnavailable: boolean;
  bestSellersUnavailable: boolean;
  bestClientsUnavailable: boolean;
  salespeopleRankingsUnavailable: boolean;
  operationalDataUnavailable: boolean;
  complianceDataUnavailable: boolean;
  eanRegistry: EanRegistryEntry[];
  eanRegistryTotal: number;
  complianceExceptions: ComplianceException[];
}
