import { describe, expect, it } from "vitest";
import {
  assertCompanyIsolation,
  composePortfolioExposureFacts,
  filterExposureByCompanyIds,
  sumPortfolioOutstanding,
} from "../financeExposureAdaptor";

describe("Point81 portfolio exposure adaptor", () => {
  const sourceCompanies = [
    {
      id: "company-a",
      business_name: "Alpha Traders",
      total_outstanding: 120000,
      credit_limit: 500000,
      is_frozen: false,
    },
    {
      id: "company-b",
      business_name: "Beta Foods",
      total_outstanding: 80000,
      credit_limit: 300000,
      is_frozen: true,
    },
  ];

  it("composes exposure from Core company.total_outstanding — not client order sums", () => {
    const facts = composePortfolioExposureFacts({ companies: sourceCompanies });
    expect(facts.exposure_facts_only).toBe(true);
    expect(facts.total_outstanding).toBe(200000);
    expect(facts.company_count).toBe(2);
    expect(facts.frozen_company_count).toBe(1);
    expect(facts.companies[0].totalOutstanding).toBe(120000);
  });

  it("sums portfolio outstanding deterministically", () => {
    expect(sumPortfolioOutstanding(sourceCompanies)).toBe(200000);
  });

  it("enforces company isolation when filtering exposure", () => {
    const facts = composePortfolioExposureFacts({ companies: sourceCompanies });
    const scoped = filterExposureByCompanyIds(facts, ["company-a"]);
    expect(scoped.company_count).toBe(1);
    expect(scoped.total_outstanding).toBe(120000);
    assertCompanyIsolation(scoped, ["company-a"]);
  });

  it("detects company isolation breach", () => {
    const facts = composePortfolioExposureFacts({ companies: sourceCompanies });
    expect(() => assertCompanyIsolation(facts, ["company-a", "company-c"])).toThrow("isolation breach");
  });

  it("binds optional wallet balances per company without substituting outstanding", () => {
    const facts = composePortfolioExposureFacts({
      companies: sourceCompanies,
      walletBalances: { "company-a": 5000, "company-b": null },
    });
    expect(facts.companies[0].walletBalance).toBe(5000);
    expect(facts.companies[1].walletBalance).toBeNull();
    expect(facts.total_outstanding).toBe(200000);
  });
});
