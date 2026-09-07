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
  buildBestClientRankings,
  buildBestSalespersonRankings,
  buildBestSellerRankings,
  buildDelayRiskSnapshot,
  buildOperationalPositionSnapshot,
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
  slaBreachedSupportCount: number;
  disputedLedgerCount: number;
  disputedOrHeldAmount: number;
  periodStartIso: string;
  periodEndIso: string;
  referenceDate?: Date;
  eanSearchQuery?: string;
  eanOffset?: number;
  eanLimit?: number;
  coreFinance255?: import("./coreFinance255ReadClient").CoreFinance255CollectionsSnapshot | null;
  coreFinanceWarnings?: string[];
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

  const rankings = {
    bestSellers: buildBestSellerRankings(input.orderItems),
    bestClients: buildBestClientRankings(input.orders, input.companies),
    bestSalespeople: buildBestSalespersonRankings(input.orders, input.companies, input.users),
  };

  const collections = input.includeFinance
    ? buildCollectionsReportingSnapshot({
        orders: input.orders,
        companies: input.companyCredit,
        disputedOrHeldAmount: input.disputedOrHeldAmount,
        periodStartIso: input.periodStartIso,
        periodEndIso: input.periodEndIso,
        referenceDate: ref,
        coreFinance255: input.coreFinance255,
      })
    : null;

  const { entries: eanRegistry, total: eanRegistryTotal } = buildEanRegistryEntries(
    input.products,
    input.eanLimit ?? 50,
    input.eanOffset ?? 0,
    input.eanSearchQuery ?? "",
  );

  const complianceExceptions = buildComplianceExceptions({
    products: input.products,
    companies: input.companyCompliance,
  });

  return {
    asOfIso: ref.toISOString(),
    operational,
    rankings,
    delayRisk,
    collections,
    finance255Blockers: listCoreFinance255Blockers(),
    finance255AvailableContracts: listCoreFinance255AvailableContracts(),
    finance255ProductionAnchor: CORE_FINANCE_255_PRODUCTION_ANCHOR,
    coreFinanceWarnings: input.coreFinanceWarnings ?? [],
    eanRegistry,
    eanRegistryTotal,
    complianceExceptions,
  };
}

export type { ProductComplianceRow, CompanyComplianceRow };
