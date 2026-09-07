import type { ManagementCommandCenterProjection } from "./managementReportingTypes";
import {
  listCoreFinance255Blockers,
  listCoreFinance255AvailableContracts,
  CORE_FINANCE_255_PRODUCTION_ANCHOR,
} from "./coreFinance255Adapter";
import { buildCollectionsReportingSnapshot } from "./collectionsReportingProjection";
import {
  buildComplianceExceptions,
  buildEanRegistryEntries,
  type CompanyComplianceRow,
  type ProductComplianceRow,
} from "./eanComplianceRegistry";
import {
  buildDelayRiskSnapshot,
  buildOperationalPositionSnapshot,
  buildPeriodRankingsWithTrends,
  type CompanyFactRow,
  type OrderFactRow,
  type OrderItemFactRow,
  type UserFactRow,
} from "./operationalMetricsProjection";

export interface ManagementReportingInput {
  orders: OrderFactRow[];
  orderItems: OrderItemFactRow[];
  companies: CompanyFactRow[];
  companyCredit: Array<CompanyFactRow & { wallet_balance: number | null; credit_limit: number | null; allow_credit: boolean | null; is_frozen: boolean | null }>;
  users: UserFactRow[];
  products: ProductComplianceRow[];
  companyCompliance: CompanyComplianceRow[];
  slaBreachedSupportCount: number | null;
  disputedLedgerCount: number | null;
  disputedOrHeldAmount: number;
  disputedOrHeldUnavailable?: boolean;
  disputedOrHeldBlocker?: string;
  periodStartIso: string;
  periodEndIso: string;
  referenceDate?: Date;
  eanSearchQuery?: string;
  eanOffset?: number;
  eanLimit?: number;
  coreFinance255?: import("./coreFinance255ReadClient").CoreFinance255CollectionsSnapshot | null;
  coreFinanceWarnings?: string[];
  sourceReadWarnings?: string[];
  rankingsUnavailable?: boolean;
  complianceDataUnavailable?: boolean;
  includeFinance?: boolean;
}

export function buildManagementCommandCenterProjection(
  input: ManagementReportingInput,
): ManagementCommandCenterProjection {
  const ref = input.referenceDate ?? new Date();

  const operational = buildOperationalPositionSnapshot(input.orders, ref);
  const delayRisk = buildDelayRiskSnapshot({
    orders: input.orders,
    slaBreachedSupportCount: input.slaBreachedSupportCount,
    disputedLedgerCount: input.disputedLedgerCount,
  });

  const rankings = input.rankingsUnavailable
    ? { bestSellers: [], bestClients: [], bestSalespeople: [] }
    : buildPeriodRankingsWithTrends({
        orders: input.orders,
        orderItems: input.orderItems,
        companies: input.companies,
        users: input.users,
        periodStartIso: input.periodStartIso,
        periodEndIso: input.periodEndIso,
      });

  const rankingPeriodLabel = `${input.periodStartIso.slice(0, 10)} → ${input.periodEndIso.slice(0, 10)} vs prior window`;

  const collections = input.includeFinance
    ? buildCollectionsReportingSnapshot({
        orders: input.orders,
        companies: input.companyCredit,
        disputedOrHeldAmount: input.disputedOrHeldAmount,
        disputedOrHeldUnavailable: input.disputedOrHeldUnavailable,
        disputedOrHeldBlocker: input.disputedOrHeldBlocker,
        periodStartIso: input.periodStartIso,
        periodEndIso: input.periodEndIso,
        referenceDate: ref,
        coreFinance255: input.coreFinance255,
      })
    : null;

  const productsForCompliance = input.complianceDataUnavailable ? [] : input.products;
  const companiesForCompliance = input.complianceDataUnavailable ? [] : input.companyCompliance;

  const { entries: eanRegistry, total: eanRegistryTotal } = buildEanRegistryEntries(
    productsForCompliance,
    input.eanLimit ?? 50,
    input.eanOffset ?? 0,
    input.eanSearchQuery ?? "",
  );

  const complianceExceptions = buildComplianceExceptions({
    products: productsForCompliance,
    companies: companiesForCompliance,
  });

  return {
    asOfIso: ref.toISOString(),
    operational,
    rankings,
    rankingPeriodLabel,
    delayRisk,
    collections,
    finance255Blockers: listCoreFinance255Blockers(),
    finance255AvailableContracts: listCoreFinance255AvailableContracts(),
    finance255ProductionAnchor: CORE_FINANCE_255_PRODUCTION_ANCHOR,
    coreFinanceWarnings: input.coreFinanceWarnings ?? [],
    sourceReadWarnings: input.sourceReadWarnings ?? [],
    rankingsUnavailable: input.rankingsUnavailable ?? false,
    complianceDataUnavailable: input.complianceDataUnavailable ?? false,
    eanRegistry,
    eanRegistryTotal,
    complianceExceptions,
  };
}

export type { ProductComplianceRow, CompanyComplianceRow };
