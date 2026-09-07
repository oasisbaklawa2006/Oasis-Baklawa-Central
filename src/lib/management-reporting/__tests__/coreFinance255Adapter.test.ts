import { describe, expect, it } from "vitest";
import {
  getCoreFinance255CapabilityStatus,
  isCoreFinance255ProductionCertified,
  listCoreFinance255Blockers,
  resolveFinanceMetric,
} from "../coreFinance255Adapter";

describe("coreFinance255Adapter", () => {
  it("fail-closes all macro capabilities until Core #255 is production-certified", () => {
    expect(isCoreFinance255ProductionCertified()).toBe(false);
    const blockers = listCoreFinance255Blockers();
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.every((b) => b.includes("Core #255"))).toBe(true);
  });

  it("returns unavailable semantics for portfolio ageing", () => {
    const status = getCoreFinance255CapabilityStatus("portfolio_ageing_authoritative");
    expect(status.available).toBe(false);
    expect(status.semantics).toBe("unavailable");
    expect(status.coreContract).toBe("get_finance_portfolio_ageing_v1");
  });

  it("wraps observed Central facts when Core macro is pending", () => {
    const metric = resolveFinanceMetric(
      "recoverable_vs_recovered_macro",
      125000,
      "orders.payment_status!=paid",
    );
    expect(metric.value).toBe(125000);
    expect(metric.semantics).toBe("observed");
    expect(metric.source).toContain("Central observed");
  });
});
