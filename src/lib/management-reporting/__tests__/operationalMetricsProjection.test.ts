import { describe, expect, it } from "vitest";
import {
  buildBestClientRankings,
  buildBestSellerRankings,
  buildComparisonWindows,
  buildOperationalPositionSnapshot,
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
});
