import { describe, expect, it } from "vitest";
import {
  CORE_FINANCE_255_PRODUCTION_ANCHOR,
  getCoreFinance255CapabilityStatus,
  isCoreFinance255ProductionCertified,
  isCoreFinance255FullyCertified,
  listCoreFinance255Blockers,
  listCoreFinance255AvailableContracts,
  resolveFinanceMetric,
} from "../coreFinance255Adapter";

describe("coreFinance255Adapter", () => {
  it("binds to production-verified Core #255 contracts where deployed", () => {
    expect(CORE_FINANCE_255_PRODUCTION_ANCHOR).toBe(
      "cd078c5256f7fc4fecffb86cd30df20a94f3efae",
    );
    expect(isCoreFinance255ProductionCertified()).toBe(true);
    expect(isCoreFinance255FullyCertified()).toBe(false);
    const available = listCoreFinance255AvailableContracts();
    expect(available).toContain("get_order_payment_facts_v1");
    expect(available).toContain("get_credit_exposure_facts_v1");
  });

  it("fail-closes metrics without deployed macro RPCs", () => {
    const blockers = listCoreFinance255Blockers();
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.some((b) => b.includes("profitability"))).toBe(true);
    expect(getCoreFinance255CapabilityStatus("profitability_margin").available).toBe(false);
  });

  it("uses Core contract provenance for available recoverable metric", () => {
    const metric = resolveFinanceMetric(
      "recoverable_vs_recovered_macro",
      125000,
      "orders.payment_status!=paid",
    );
    expect(metric.value).toBe(125000);
    expect(metric.semantics).toBe("observed");
    expect(metric.source).toContain("get_order_payment_facts_v1");
    expect(metric.source).toContain("cd078c5");
  });

  it("marks profitability unavailable without inventing values", () => {
    const metric = resolveFinanceMetric("profitability_margin", 0, "fallback");
    expect(metric.semantics).toBe("unavailable");
    expect(metric.blocker).toContain("profitability");
  });
});
