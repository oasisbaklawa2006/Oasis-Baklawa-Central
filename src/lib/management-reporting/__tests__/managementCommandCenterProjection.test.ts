import { describe, expect, it } from "vitest";
import { buildManagementCommandCenterProjection } from "../managementCommandCenterProjection";

describe("managementCommandCenterProjection", () => {
  it("assembles unified projection with finance fail-closed blockers", () => {
    const projection = buildManagementCommandCenterProjection({
      orders: [
        {
          id: "o1",
          status: "dispatched",
          payment_status: "partial",
          sales_order_value: 10000,
          advance_paid: 1000,
          advance_required: 0,
          company_id: "c1",
          created_at: "2026-09-07T08:00:00.000Z",
        },
      ],
      orderItems: [
        { order_id: "o1", product_id: "p1", quantity: 4, product_name: "Baklava" },
      ],
      companies: [{ id: "c1", business_name: "Alpha Traders", account_manager_id: "u1" }],
      companyCredit: [
        {
          id: "c1",
          business_name: "Alpha Traders",
          wallet_balance: 0,
          credit_limit: 50000,
          allow_credit: true,
          is_frozen: false,
        },
      ],
      users: [{ id: "u1", full_name: "Sales Rep", name: null }],
      products: [
        {
          id: "p1",
          name: "Baklava",
          sku: "BK-1",
          barcode_sku: "8901234567890",
          hsn_code: "1905",
          gst_percentage: 5,
          allergen_warnings: "Nuts",
          ingredients: "Flour",
          nutrition_facts: { calories: 100 },
          is_active: true,
        },
      ],
      companyCompliance: [
        { id: "c1", business_name: "Alpha Traders", fssai_number: "123", gst_number: "GST1" },
      ],
      slaBreachedSupportCount: 2,
      disputedLedgerCount: 1,
      disputedOrHeldAmount: 500,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      includeFinance: true,
    });

    expect(projection.operational.dispatchedCount.value).toBe(1);
    expect(projection.rankings.bestSellers[0]?.label).toBe("Baklava");
    expect(projection.rankingPeriodLabel).toContain("2026-09-01");
    expect(projection.collections?.recoverableOutstanding.semantics).toBe("observed");
    expect(projection.finance255AvailableContracts.length).toBeGreaterThan(0);
    expect(projection.finance255ProductionAnchor).toContain("cd078c5");
    expect(projection.finance255Blockers.length).toBeGreaterThan(0);
    expect(projection.collections?.profitability.semantics).toBe("unavailable");
    expect(projection.complianceExceptions.length).toBeGreaterThanOrEqual(0);
  });

  it("keeps seller/client rankings when only salesperson enrichment is unavailable", () => {
    const projection = buildManagementCommandCenterProjection({
      orders: [
        {
          id: "o1",
          status: "confirmed",
          payment_status: "paid",
          sales_order_value: 5000,
          advance_paid: 5000,
          advance_required: 0,
          company_id: "c1",
          created_at: "2026-09-15T10:00:00.000Z",
        },
      ],
      orderItems: [
        { order_id: "o1", product_id: "p1", quantity: 10, product_name: "Baklava" },
      ],
      companies: [{ id: "c1", business_name: "Alpha Traders", account_manager_id: "u1" }],
      companyCredit: [
        {
          id: "c1",
          business_name: "Alpha Traders",
          wallet_balance: 0,
          credit_limit: 0,
          allow_credit: false,
          is_frozen: false,
        },
      ],
      users: [],
      products: [],
      companyCompliance: [],
      slaBreachedSupportCount: 0,
      disputedLedgerCount: 0,
      disputedOrHeldAmount: 0,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      salespeopleRankingsUnavailable: true,
    });

    expect(projection.rankings.bestSellers.length).toBeGreaterThan(0);
    expect(projection.rankings.bestClients.length).toBeGreaterThan(0);
    expect(projection.rankings.bestSalespeople).toEqual([]);
  });

  it("marks delay risk order-derived counts unavailable when orders truncated", () => {
    const projection = buildManagementCommandCenterProjection({
      orders: [
        {
          id: "o1",
          status: "confirmed",
          payment_status: "partial",
          sales_order_value: 5000,
          advance_paid: 0,
          advance_required: 1000,
          company_id: "c1",
          created_at: "2026-09-07T08:00:00.000Z",
        },
      ],
      orderItems: [],
      companies: [{ id: "c1", business_name: "Alpha Traders" }],
      companyCredit: [
        {
          id: "c1",
          business_name: "Alpha Traders",
          wallet_balance: 0,
          credit_limit: 0,
          allow_credit: false,
          is_frozen: false,
        },
      ],
      users: [],
      products: [],
      companyCompliance: [],
      slaBreachedSupportCount: 1,
      disputedLedgerCount: 0,
      disputedOrHeldAmount: 0,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      operationalDataUnavailable: true,
      ordersTruncated: true,
    });

    expect(projection.operational.comparisons.semantics).toBe("unavailable");
    expect(projection.delayRisk.orderDerivedSemantics).toBe("unavailable");
    expect(projection.delayRisk.financeHoldCount).toBeNull();
  });
});
