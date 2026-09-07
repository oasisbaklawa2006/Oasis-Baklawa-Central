import type { ManagementCommandCenterProjection } from "./managementReportingTypes";
import { listCoreFinance255Blockers } from "./coreFinance255Adapter";
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
      })
    : null;

  const { entries: eanRegistry } = buildEanRegistryEntries(
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
    eanRegistry,
    complianceExceptions,
  };
}

export type { ProductComplianceRow, CompanyComplianceRow };
