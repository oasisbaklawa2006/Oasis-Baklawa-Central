import { describe, expect, it } from "vitest";
import { buildCollectionsReportingSnapshot } from "../collectionsReportingProjection";
import type { OrderFactRow } from "../operationalMetricsProjection";

describe("collectionsReportingProjection", () => {
  it("builds ageing buckets from unpaid order created_at", () => {
    const ref = new Date("2026-09-07T12:00:00.000Z");
    const orders: OrderFactRow[] = [
      {
        id: "o1",
        status: "dispatched",
        payment_status: "partial",
        sales_order_value: 10000,
        advance_paid: 2000,
        advance_required: 0,
        company_id: "c1",
        created_at: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "o2",
        status: "confirmed",
        payment_status: "unpaid",
        sales_order_value: 5000,
        advance_paid: 0,
        advance_required: 1000,
        company_id: "c2",
        created_at: "2026-09-01T10:00:00.000Z",
      },
    ];
    const snap = buildCollectionsReportingSnapshot({
      orders,
      companies: [
        {
          id: "c1",
          business_name: "A",
          wallet_balance: -500,
          credit_limit: 10000,
          allow_credit: true,
          is_frozen: false,
        },
        {
          id: "c2",
          business_name: "B",
          wallet_balance: 0,
          credit_limit: 0,
          allow_credit: false,
          is_frozen: false,
        },
      ],
      disputedOrHeldAmount: 1500,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      referenceDate: ref,
    });

    expect(snap.recoverableOutstanding.value).toBe(13000);
    expect(snap.recoverableOutstanding.semantics).toBe("observed");
    expect(snap.recoveredInPeriod.semantics).toBe("unavailable");
    expect(snap.ageingBuckets.find((b) => b.bucket === "31-60")?.orderCount).toBe(1);
    expect(snap.ageingBuckets.find((b) => b.bucket === "0-30")?.orderCount).toBe(1);
    expect(snap.topExposureClients[0]?.metric).toBe(8000);
    expect(snap.creditRisk.frozenAccountCount).toBe(0);
    expect(snap.creditRisk.highExposureCount).toBeGreaterThan(0);
    expect(snap.ageingSource).toContain("Central order.created_at");
    expect(snap.walletExposure.source).toContain("Central table");
    expect(snap.walletExposure.source).not.toContain("core:#255");
  });

  it("uses Core timestamped payment facts for recovered-in-period when available", () => {
    const snap = buildCollectionsReportingSnapshot({
      orders: [],
      companies: [],
      disputedOrHeldAmount: 0,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      coreFinance255: {
        recoverableOutstanding: 0,
        recoveredInPeriod: 4200,
        recoveredInPeriodAvailable: true,
        recoveredInPeriodBlocker: null,
        ordersWithCoreFacts: 0,
        ordersAttempted: 0,
        recoveryOrdersWithFacts: 3,
        recoveryOrdersAttempted: 5,
        unpaidLookupBounded: false,
        recoveryLookupBounded: false,
        source: "core:#255/get_order_payment_facts_v1@cd078c5",
        warnings: [],
      },
    });
    expect(snap.recoveredInPeriod.semantics).toBe("observed");
    expect(snap.recoveredInPeriod.value).toBe(4200);
  });

  it("marks recoverable unavailable when Core unpaid lookup is bounded", () => {
    const snap = buildCollectionsReportingSnapshot({
      orders: [],
      companies: [],
      disputedOrHeldAmount: 0,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      coreFinance255: {
        recoverableOutstanding: 9000,
        recoveredInPeriod: 0,
        recoveredInPeriodAvailable: false,
        recoveredInPeriodBlocker: "bounded",
        ordersWithCoreFacts: 3,
        ordersAttempted: 25,
        recoveryOrdersWithFacts: 0,
        recoveryOrdersAttempted: 0,
        unpaidLookupBounded: true,
        recoveryLookupBounded: false,
        source: "core:#255/get_order_payment_facts_v1@cd078c5",
        warnings: [],
      },
    });
    expect(snap.recoverableOutstanding.semantics).toBe("unavailable");
  });

  it("marks recoverable unavailable when orders source is truncated", () => {
    const snap = buildCollectionsReportingSnapshot({
      orders: [
        {
          id: "o1",
          status: "confirmed",
          payment_status: "unpaid",
          sales_order_value: 1000,
          advance_paid: 0,
          advance_required: 0,
          company_id: "c1",
          created_at: "2026-09-01T10:00:00.000Z",
        },
      ],
      companies: [],
      disputedOrHeldAmount: 0,
      ordersTruncated: true,
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
    });
    expect(snap.recoverableOutstanding.semantics).toBe("unavailable");
    expect(snap.ageingBuckets).toEqual([]);
  });
});
