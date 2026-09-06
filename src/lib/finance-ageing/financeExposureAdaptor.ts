import {
  CompanyExposureRow,
  PortfolioExposureFacts,
  POINT81_CORE_PREREQUISITES,
} from "./financeAgeingContracts";

export class FinanceExposureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceExposureError";
  }
}

export type CompanyExposureSourceRow = {
  id: string;
  business_name: string;
  total_outstanding: number | null;
  credit_limit: number | null;
  is_frozen: boolean | null;
  wallet_balance?: number | null;
};

export type PortfolioExposureSource = {
  companies: CompanyExposureSourceRow[];
  walletBalances?: Record<string, number | null>;
  asOfDate?: string;
};

function requiredNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new FinanceExposureError(`Invalid ${field}`);
  return n;
}

function isoDate(value?: string): string {
  if (value && value.trim()) return value.trim();
  return new Date().toISOString().slice(0, 10);
}

/** Compose portfolio exposure from Core company columns — never from client order sums. */
export function composePortfolioExposureFacts(source: PortfolioExposureSource): PortfolioExposureFacts {
  if (!Array.isArray(source.companies)) {
    throw new FinanceExposureError("Company exposure source is required");
  }

  const companies: CompanyExposureRow[] = source.companies.map((row) => {
    if (!row.id?.trim()) throw new FinanceExposureError("Company id is required for exposure binding");
    const wallet = source.walletBalances?.[row.id] ?? row.wallet_balance ?? null;
    return {
      companyId: row.id,
      businessName: row.business_name?.trim() || "—",
      totalOutstanding: requiredNumber(row.total_outstanding ?? 0, "total_outstanding"),
      creditLimit: row.credit_limit ?? null,
      isFrozen: Boolean(row.is_frozen),
      walletBalance: wallet,
    };
  });

  const totalOutstanding = companies.reduce((sum, c) => sum + c.totalOutstanding, 0);
  const frozenCompanyCount = companies.filter((c) => c.isFrozen).length;

  return {
    exposure_facts_only: true,
    as_of_date: isoDate(source.asOfDate),
    company_count: companies.length,
    total_outstanding: totalOutstanding,
    frozen_company_count: frozenCompanyCount,
    companies,
  };
}

export function sumPortfolioOutstanding(companies: CompanyExposureSourceRow[]): number {
  return composePortfolioExposureFacts({ companies }).total_outstanding;
}

export function filterExposureByCompanyIds(
  facts: PortfolioExposureFacts,
  companyIds: readonly string[],
): PortfolioExposureFacts {
  const allowed = new Set(companyIds.map((id) => id.trim()).filter(Boolean));
  const companies = facts.companies.filter((c) => allowed.has(c.companyId));
  const totalOutstanding = companies.reduce((sum, c) => sum + c.totalOutstanding, 0);
  return {
    ...facts,
    company_count: companies.length,
    total_outstanding: totalOutstanding,
    frozen_company_count: companies.filter((c) => c.isFrozen).length,
    companies,
  };
}

export function assertCompanyIsolation(
  facts: PortfolioExposureFacts,
  expectedCompanyIds: readonly string[],
): void {
  const expected = new Set(expectedCompanyIds.map((id) => id.trim()).filter(Boolean));
  const actual = new Set(facts.companies.map((c) => c.companyId));
  if (actual.size !== expected.size) {
    throw new FinanceExposureError("Company isolation breach: exposure row count mismatch");
  }
  for (const id of expected) {
    if (!actual.has(id)) throw new FinanceExposureError(`Company isolation breach: missing ${id}`);
  }
}

export function portfolioExposurePrerequisiteMessage(): string {
  return `${POINT81_CORE_PREREQUISITES.portfolioExposure.rpc} — ${POINT81_CORE_PREREQUISITES.portfolioExposure.blocker}`;
}
