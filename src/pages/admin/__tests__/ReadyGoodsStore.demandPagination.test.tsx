import { describe, expect, it, vi } from "vitest";
import { fetchAllRgsFactoryOrderLines } from "../ReadyGoodsStore";
import { makeKeysetFakeDb } from "@/lib/rgs/__tests__/keysetFakeDb";

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
  const orders = [];
  for (let o = 0; o * perOrder < lineCount; o += 1) {
    const items = [];
    for (let k = 0; k < perOrder && o * perOrder + k < lineCount; k += 1) {
      items.push({ id: lineId(o * perOrder + k), order_id: orderId(o), product_id: "same-sku", quantity: 1 });
    }
    orders.push({ id: orderId(o), status: "approved", created_at: createdAt(o), company: { business_name: "Acme" }, order_items: items });
  }
  return orders;
}

describe("Factory F04 canonical SO-line visibility (parent-order keyset)", () => {
  it("preserves every original order_item.id across 605 same-SKU lines, with a page size forcing multiple pages", async () => {
    const { db, calls } = makeKeysetFakeDb({ orders: buildOrders() });
    const result = await fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 4);

    expect(result).toHaveLength(605);
    expect(new Set(result.map((row) => row.id)).size).toBe(605);
    expect(calls.filter((c) => c.relation === "orders").length).toBeGreaterThan(3);
    expect(calls.some((c) => c.orFilter?.includes("id.gt."))).toBe(true);
    expect(result.every((row) => row.order?.id === row.order_id)).toBe(true);
  });

  it("returns lines ordered by (orders.created_at, order_items.id) even when the source is in reverse order", async () => {
    const reversed = buildOrders().reverse().map((o) => ({ ...o, order_items: [...o.order_items].reverse() }));
    const { db } = makeKeysetFakeDb({ orders: reversed });
    const result = await fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 3);

    const keys = result.map((row) => [row.order?.created_at as string, row.id] as const);
    const sorted = [...keys].sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
    // Parent order priority is by created_at then order id; within an order, line id.
    expect(keys.map((k) => k[0])).toEqual(sorted.map((k) => k[0]));
    for (let i = 1; i < result.length; i += 1) {
      if (result[i - 1].order_id === result[i].order_id) expect(result[i - 1].id < result[i].id).toBe(true);
    }
    expect(result).toHaveLength(605);
  });

  it("does not skip orders sharing one created_at across a page boundary", async () => {
    const same = buildOrders().map((o) => ({ ...o, created_at: "2026-10-01T08:00:00+00:00" }));
    const { db } = makeKeysetFakeDb({ orders: same });
    expect(await fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 2)).toHaveLength(605);
  });

  it("reads orders with a NULL created_at instead of silently dropping them", async () => {
    const orders = buildOrders(110, 55);
    orders.push({ id: "order-null", status: "approved", created_at: null as unknown as string, company: null,
      order_items: [{ id: "line-null", order_id: "order-null", product_id: "same-sku", quantity: 1 }] });
    const { db } = makeKeysetFakeDb({ orders });
    const result = await fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 2);
    expect(result.map((r) => r.id)).toContain("line-null");
    expect(result).toHaveLength(111);
  });

  it("fails the entire intake snapshot if a later page is unreadable", async () => {
    const { db } = makeKeysetFakeDb({ orders: buildOrders() }, ({ index }) =>
      index === 1 ? { data: null, error: { message: "request timed out" } } : undefined);
    await expect(fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 2)).rejects.toThrow(
      "Factory order line read failed: request timed out",
    );
  });

  it("rejects a repeated or non-monotonic order page (changing cursor)", async () => {
    const orders = buildOrders();
    const { db } = makeKeysetFakeDb({ orders }, ({ index }) =>
      index === 1 ? { data: [orders[0], orders[1]], error: null } : undefined);
    await expect(fetchAllRgsFactoryOrderLines(db as unknown as FactoryDb, 2)).rejects.toThrow(/source changed|non-monotonic/);
  });

  it("rejects a duplicate order_item id across orders and a line pointing at a different order", async () => {
    const dup = buildOrders(110, 55);
    dup[1].order_items[0] = { ...dup[1].order_items[0], id: dup[0].order_items[0].id };
    await expect(fetchAllRgsFactoryOrderLines(makeKeysetFakeDb({ orders: dup }).db as unknown as FactoryDb))
      .rejects.toThrow("source changed during pagination");

    const wrong = buildOrders(110, 55);
    wrong[0].order_items[0] = { ...wrong[0].order_items[0], order_id: "someone-else" };
    await expect(fetchAllRgsFactoryOrderLines(makeKeysetFakeDb({ orders: wrong }).db as unknown as FactoryDb))
      .rejects.toThrow("source changed during pagination");
  });

  it("rejects invalid page responses, missing embedded lines and out-of-range page sizes", async () => {
    const bad = makeKeysetFakeDb({}, () => ({ data: null, error: null }));
    await expect(fetchAllRgsFactoryOrderLines(bad.db as unknown as FactoryDb)).rejects.toThrow("invalid data");
    const noItems = [{ id: "o1", status: "approved", created_at: createdAt(1), company: null, order_items: null }];
    await expect(fetchAllRgsFactoryOrderLines(makeKeysetFakeDb({ orders: noItems }).db as unknown as FactoryDb)).rejects.toThrow("invalid data");
    await expect(fetchAllRgsFactoryOrderLines(makeKeysetFakeDb({}).db as unknown as FactoryDb, 1001)).rejects.toThrow("invalid page size");
  });
});
