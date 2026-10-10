import { describe, expect, it } from "vitest";
import {
  buildBestClientRankings,
  buildBestSellerRankings,
  buildComparisonWindows,
  buildDelayRiskSnapshot,
  buildOperationalPositionSnapshot,
  buildPeriodRankingsWithTrends,
  priorPeriodBounds,
  type OrderFactRow,
  type OrderItemFactRow,
} from "../operationalMetricsProjection";

const REF = new Date("2026-09-07T12:00:00.000Z");

function order(partial: Partial<OrderFactRow> & Pick<OrderFactRow, "id">): OrderFactRow {
  return {
    status: "confirmed",
    payment_status: "partial",
    sales_order_value: 10000,
    advance_paid: 2000,
    advance_required: 3000,
    company_id: "c1",
    created_at: "2026-09-07T10:00:00.000Z",
    ...partial,
  };
}

describe("operationalMetricsProjection", () => {
  it("builds four comparison windows from reference date", () => {
    const windows = buildComparisonWindows(REF);
    expect(windows.map((w) => w.key)).toEqual([
      "today",
      "same_day_last_week",
      "same_day_last_month",
      "same_day_last_year",
    ]);
  });

  it("computes operational position from canonical order facts", () => {
    const orders: OrderFactRow[] = [
      order({ id: "o1", status: "in_production" }),
      order({ id: "o2", status: "packed_ready" }),
      order({
        id: "o3",
        status: "dispatched",
        payment_status: "partial",
        sales_order_value: 50000,
        advance_paid: 10000,
      }),
      order({ id: "o4", status: "draft" }),
    ];
    const snap = buildOperationalPositionSnapshot(orders, REF);
    expect(snap.salesOrderCount.value).toBe(3);
    expect(snap.productionInFlight.value).toBe(1);
    expect(snap.packedAwaitingDispatch.value).toBe(1);
    expect(snap.dispatchedCount.value).toBe(1);
    expect(snap.collectionsPending.value).toBe(40000);
    expect(snap.salesOrderCount.semantics).toBe("observed");
  });

  it("ranks best sellers by ordered quantity", () => {
    const items: OrderItemFactRow[] = [
      { order_id: "o1", product_id: "p1", quantity: 5, product_name: "Baklava" },
      { order_id: "o2", product_id: "p2", quantity: 12, product_name: "Kunafa" },
      { order_id: "o3", product_id: "p1", quantity: 3, product_name: "Baklava" },
    ];
    const ranked = buildBestSellerRankings(items, 2);
    expect(ranked[0]?.id).toBe("p2");
    expect(ranked[0]?.metric).toBe(12);
    expect(ranked[1]?.metric).toBe(8);
  });

  it("ranks best clients by order value", () => {
    const orders: OrderFactRow[] = [
      order({ id: "o1", company_id: "c1", sales_order_value: 1000 }),
      order({ id: "o2", company_id: "c2", sales_order_value: 5000 }),
    ];
    const ranked = buildBestClientRankings(
      orders,
      [
        { id: "c1", business_name: "Alpha" },
        { id: "c2", business_name: "Beta" },
      ],
    );
    expect(ranked[0]?.label).toBe("Beta");
    expect(ranked[0]?.metric).toBe(5000);
  });

  it("computes prior period bounds of equal length", () => {
    const prior = priorPeriodBounds("2026-09-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z");
    expect(new Date(prior.endIso).getTime()).toBeLessThan(new Date("2026-09-01T00:00:00.000Z").getTime());
  });

  it("builds period rankings with trend vs prior window", () => {
    const orders: OrderFactRow[] = [
      order({
        id: "o-current",
        company_id: "c1",
        sales_order_value: 5000,
        created_at: "2026-09-15T10:00:00.000Z",
      }),
      order({
        id: "o-prior",
        company_id: "c2",
        sales_order_value: 2000,
        created_at: "2026-08-15T10:00:00.000Z",
      }),
    ];
    const items: OrderItemFactRow[] = [
      { order_id: "o-current", product_id: "p1", quantity: 10, product_name: "Baklava" },
      { order_id: "o-prior", product_id: "p1", quantity: 2, product_name: "Baklava" },
    ];
    const ranked = buildPeriodRankingsWithTrends({
      orders,
      orderItems: items,
      companies: [
        { id: "c1", business_name: "Alpha" },
        { id: "c2", business_name: "Beta" },
      ],
      users: [],
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
    });
    expect(ranked.bestSellers[0]?.metric).toBe(10);
    expect(ranked.bestSellers[0]?.priorMetric).toBe(2);
    expect(ranked.bestSellers[0]?.trendDelta).toBe(8);
    expect(ranked.bestClients[0]?.label).toBe("Alpha");
  });

  it("uses complete prior lookup for entities outside prior top-N", () => {
    const orders: OrderFactRow[] = [
      order({
        id: "o-current-a",
        company_id: "c-current",
        sales_order_value: 9000,
        created_at: "2026-09-20T10:00:00.000Z",
      }),
      order({
        id: "o-prior-a",
        company_id: "c-current",
        sales_order_value: 1500,
        created_at: "2026-08-20T10:00:00.000Z",
      }),
      ...Array.from({ length: 5 }, (_, i) =>
        order({
          id: `o-prior-top-${i}`,
          company_id: `c-top-${i}`,
          sales_order_value: 10000 - i,
          created_at: "2026-08-10T10:00:00.000Z",
        }),
      ),
    ];
    const ranked = buildPeriodRankingsWithTrends({
      orders,
      orderItems: [],
      companies: [
        { id: "c-current", business_name: "Current Leader" },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `c-top-${i}`,
          business_name: `Top ${i}`,
        })),
      ],
      users: [],
      periodStartIso: "2026-09-01T00:00:00.000Z",
      periodEndIso: "2026-09-30T23:59:59.999Z",
      limit: 1,
    });
    expect(ranked.bestClients[0]?.label).toBe("Current Leader");
    expect(ranked.bestClients[0]?.priorMetric).toBe(1500);
    expect(ranked.bestClients[0]?.trendDelta).toBe(7500);
  });

  it("marks operational metrics unavailable when source is truncated", () => {
    const snap = buildOperationalPositionSnapshot([], REF, {
      unavailable: true,
      unavailableReason: "orders read truncated",
    });
    expect(snap.salesOrderCount.semantics).toBe("unavailable");
    expect(snap.comparisons.semantics).toBe("unavailable");
    expect(snap.comparisons.items).toEqual([]);
    expect(snap.comparisons.blocker).toContain("truncated");
  });

  it("builds observed comparisons with governed breakdown semantics", () => {
    const orders: OrderFactRow[] = [
      order({ id: "o1", created_at: "2026-09-07T10:00:00.000Z" }),
    ];
    const snap = buildOperationalPositionSnapshot(orders, REF);
    expect(snap.comparisons.semantics).toBe("observed");
    expect(snap.comparisons.items.length).toBe(4);
  });

  it("marks order-derived delay risk unavailable when orders truncated", () => {
    const snap = buildDelayRiskSnapshot({
      orders: [
        order({
          id: "o1",
          advance_required: 5000,
          advance_paid: 0,
          status: "awaiting_final_payment",
        }),
      ],
      slaBreachedSupportCount: 2,
      disputedLedgerCount: 1,
      ordersTruncated: true,
    });
    expect(snap.orderDerivedSemantics).toBe("unavailable");
    expect(snap.financeHoldCount).toBeNull();
    expect(snap.awaitingFinalPaymentCount).toBeNull();
    expect(snap.slaBreachedSemantics).toBe("observed");
    expect(snap.slaBreachedSupportCount).toBe(2);
  });
});
