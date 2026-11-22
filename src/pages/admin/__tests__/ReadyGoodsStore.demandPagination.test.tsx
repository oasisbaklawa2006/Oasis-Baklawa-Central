import { describe, expect, it, vi } from "vitest";
import { fetchAllRgsFactoryOrderLines } from "../ReadyGoodsStore";
import { makeKeysetFakeDb } from "@/lib/rgs/__tests__/keysetFakeDb";
import { compareTimestamps } from "@/lib/rgs/rgsKeysetLoader";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/rgsGovernedRpc", () => ({ rgsGovernedRpc: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

type FactoryDb = Parameters<typeof fetchAllRgsFactoryOrderLines>[0];

const lineId = (i: number) => `line-${String(i).padStart(5, "0")}`;
const orderId = (i: number) => `order-${String(i).padStart(4, "0")}`;
// Order i is created on day (i % 25) so many orders share a timestamp (tie-break by id).
const createdAt = (i: number) => `2026-10-${String(1 + (i % 25)).padStart(2, "0")}T08:00:00.000000+00:00`;

/** 605 same-SKU lines spread over 11 orders (55 lines each). */
function buildOrders(lineCount = 605, perOrder = 55) {
  const orders: Array<Record<string, unknown>> = [];
  const items: Array<Record<string, unknown>> = [];
  for (let o = 0; o * perOrder < lineCount; o += 1) {
    orders.push({ id: orderId(o), status: "approved", created_at: createdAt(o), company: { business_name: "Acme" } });
    for (let k = 0; k < perOrder && o * perOrder + k < lineCount; k += 1) {
      items.push({ id: lineId(o * perOrder + k), order_id: orderId(o), product_id: "same-sku", quantity: 1 });
    }
  }
  return { orders, order_items: items };
}
const db = (tables: Record<string, Array<Record<string, unknown>>>, hook?: Parameters<typeof makeKeysetFakeDb>[1]) =>
  makeKeysetFakeDb(tables, hook);

describe("Factory F04 canonical SO-line visibility (parent-order keyset)", () => {
  it("preserves every original order_item.id across 605 same-SKU lines, with a page size forcing multiple pages", async () => {
    const fake = db(buildOrders());
    const result = await fetchAllRgsFactoryOrderLines(fake.db as unknown as FactoryDb, 4);

    expect(result).toHaveLength(605);
    expect(new Set(result.map((row) => row.id)).size).toBe(605);
    expect(fake.calls.filter((c) => c.relation === "orders").length).toBeGreaterThan(3);
    expect(fake.calls.some((c) => c.orFilter?.includes("id.gt."))).toBe(true);
    expect(result.every((row) => row.order?.id === row.order_id)).toBe(true);
  });

  it("returns lines ordered by (orders.created_at, order_items.id) even when the source is in reverse order", async () => {
    const t = buildOrders();
    const result = await fetchAllRgsFactoryOrderLines(
      db({ orders: [...t.orders].reverse(), order_items: [...t.order_items].reverse() }).db as unknown as FactoryDb, 3);

    expect(result).toHaveLength(605);
    let inOrder = true;
    result.reduce<(typeof result)[number] | null>((prev, cur) => {
      if (prev) {
        const cmp = compareTimestamps(prev.order?.created_at as string, cur.order?.created_at as string);
        if (!(cmp < 0 || (cmp === 0 && prev.id < cur.id))) inOrder = false;
      }
      return cur;
    }, null);
    expect(inOrder).toBe(true);
  });

  it("orders same-timestamp orders by LINE id across orders (not by order id first)", async () => {
    const same = "2026-10-01T08:00:00+00:00";
    const orders = [
      { id: "order-a", status: "approved", created_at: same, company: null },
      { id: "order-b", status: "approved", created_at: same, company: null },
    ];
    const items = [
      { id: "line-z", order_id: "order-a", product_id: "p", quantity: 1 },
      { id: "line-a", order_id: "order-b", product_id: "p", quantity: 1 },
      { id: "line-m", order_id: "order-a", product_id: "p", quantity: 1 },
    ];
    const result = await fetchAllRgsFactoryOrderLines(db({ orders, order_items: items }).db as unknown as FactoryDb, 2);
    expect(result.map((r) => r.id)).toEqual(["line-a", "line-m", "line-z"]);
  });

  it("puts an older order first even when its line ids sort after a newer order's", async () => {
    const orders = [
      { id: "order-new", status: "approved", created_at: "2026-10-09T00:00:00+00:00", company: null },
      { id: "order-old", status: "approved", created_at: "2026-10-01T00:00:00+00:00", company: null },
    ];
    const items = [
      { id: "line-a", order_id: "order-new", product_id: "p", quantity: 1 },
      { id: "line-z", order_id: "order-old", product_id: "p", quantity: 1 },
    ];
    const result = await fetchAllRgsFactoryOrderLines(db({ orders, order_items: items }).db as unknown as FactoryDb);
    expect(result.map((r) => r.id)).toEqual(["line-z", "line-a"]);
  });

  it("loads a single order with more lines than the page size, and more orders than one line chunk", async () => {
    const big = buildOrders(700, 700); // one order, 700 lines, page size 250
    expect(await fetchAllRgsFactoryOrderLines(db(big).db as unknown as FactoryDb)).toHaveLength(700);
    const many = buildOrders(260, 1); // 260 orders, 1 line each -> 3 line chunks
    const fake = db(many);
    expect(await fetchAllRgsFactoryOrderLines(fake.db as unknown as FactoryDb)).toHaveLength(260);
    expect(fake.calls.filter((c) => c.relation === "order_items").length).toBeGreaterThanOrEqual(3);
  });

  it("does not skip orders sharing one created_at across a page boundary", async () => {
    const t = buildOrders();
    const same = t.orders.map((o) => ({ ...o, created_at: "2026-10-01T08:00:00+00:00" }));
    expect(await fetchAllRgsFactoryOrderLines(db({ orders: same, order_items: t.order_items }).db as unknown as FactoryDb, 2)).toHaveLength(605);
  });

  it("reads orders with a NULL created_at (sorted last) instead of silently dropping them", async () => {
    const t = buildOrders(110, 55);
    t.orders.push({ id: "order-null", status: "approved", created_at: null, company: null });
    t.order_items.push({ id: "line-null", order_id: "order-null", product_id: "same-sku", quantity: 1 });
    const result = await fetchAllRgsFactoryOrderLines(db(t).db as unknown as FactoryDb, 2);
    expect(result).toHaveLength(111);
    expect(result.slice(-1).map((r) => r.id)).toEqual(["line-null"]);
  });

  it("fails the entire intake snapshot if a later order or line page is unreadable", async () => {
    await expect(fetchAllRgsFactoryOrderLines(db(buildOrders(), ({ relation, index }) =>
      relation === "orders" && index === 1 ? { data: null, error: { message: "request timed out" } } : undefined).db as unknown as FactoryDb, 2))
      .rejects.toThrow("Factory order line read failed: request timed out");
    await expect(fetchAllRgsFactoryOrderLines(db(buildOrders(), ({ relation, index }) =>
      relation === "order_items" && index === 1 ? { data: null, error: { message: "lines timed out" } } : undefined).db as unknown as FactoryDb, 2))
      .rejects.toThrow("Factory order line items read failed: lines timed out");
  });

  it("rejects a repeated order page, a repeated line page, and a line whose order was not loaded", async () => {
    const t = buildOrders();
    await expect(fetchAllRgsFactoryOrderLines(db(t, ({ relation, index }) =>
      relation === "orders" && index === 1 ? { data: [t.orders[0], t.orders[1]], error: null } : undefined).db as unknown as FactoryDb, 2))
      .rejects.toThrow(/source changed|non-monotonic/);
    await expect(fetchAllRgsFactoryOrderLines(db(t, ({ relation, index }) =>
      relation === "order_items" && index === 1 ? { data: [t.order_items[0], t.order_items[1]], error: null } : undefined).db as unknown as FactoryDb, 2))
      .rejects.toThrow(/source changed|non-monotonic/);
    const orphan = buildOrders(110, 55);
    await expect(fetchAllRgsFactoryOrderLines(db(orphan, ({ relation }) =>
      relation === "order_items" ? { data: [{ id: "line-x", order_id: "not-loaded", product_id: "p", quantity: 1 }], error: null } : undefined).db as unknown as FactoryDb))
      .rejects.toThrow("source changed during pagination");
  });

  it("rejects invalid page responses and out-of-range page sizes", async () => {
    await expect(fetchAllRgsFactoryOrderLines(db({}, () => ({ data: null, error: null })).db as unknown as FactoryDb)).rejects.toThrow("invalid data");
    await expect(fetchAllRgsFactoryOrderLines(db({}).db as unknown as FactoryDb, 1001)).rejects.toThrow("invalid page size");
  });
});
