import { describe, expect, it, vi } from "vitest";
import { fetchAllRgsFactoryOrderLines } from "../ReadyGoodsStore";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/rgsGovernedRpc", () => ({ rgsGovernedRpc: { rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

type FactoryDb = Parameters<typeof fetchAllRgsFactoryOrderLines>[0];

function demandLine(i: number) {
  return { id: `line-${i}`, order_id: "same-order", product_id: "same-sku", quantity: 1 };
}

function fakeDb(
  loadPage: (start: number, end: number) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  const pageCalls: Array<[number, number]> = [];
  const builder = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn((start: number, end: number) => {
      pageCalls.push([start, end]);
      return loadPage(start, end);
    }),
  };
  const db = { from: vi.fn(() => builder) } as unknown as FactoryDb;
  return { db, builder, pageCalls };
}

describe("Factory F04 canonical SO-line visibility", () => {
  it("preserves every original order_item.id across 605 same-SKU lines", async () => {
    const lines = Array.from({ length: 605 }, (_, i) => demandLine(i));
    const fixture = fakeDb(async (start, end) => ({ data: lines.slice(start, end + 1), error: null }));
    const result = await fetchAllRgsFactoryOrderLines(fixture.db);

    expect(result).toHaveLength(605);
    expect(new Set(result.map((row) => row.id)).size).toBe(605);
    expect(result.at(-1)?.id).toBe("line-604");
    expect(fixture.pageCalls).toEqual([[0, 249], [250, 499], [500, 749]]);
    expect(fixture.builder.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("fails the entire intake snapshot if the second page is unreadable", async () => {
    const fixture = fakeDb(async (start) => start === 0
      ? { data: Array.from({ length: 250 }, (_, i) => demandLine(i)), error: null }
      : { data: null, error: { message: "request timed out" } });
    await expect(fetchAllRgsFactoryOrderLines(fixture.db)).rejects.toThrow(
      "Factory order line read failed: request timed out",
    );
    expect(fixture.pageCalls).toEqual([[0, 249], [250, 499]]);
  });

  it("rejects duplicate order_item identities caused by changing page boundaries", async () => {
    const fixture = fakeDb(async (start) => start === 0
      ? { data: Array.from({ length: 250 }, (_, i) => demandLine(i)), error: null }
      : { data: [demandLine(249)], error: null });
    await expect(fetchAllRgsFactoryOrderLines(fixture.db)).rejects.toThrow(
      "Factory intake source changed during pagination",
    );
  });

  it("rejects invalid page responses and out-of-range page sizes", async () => {
    const fixture = fakeDb(async () => ({ data: null, error: null }));
    await expect(fetchAllRgsFactoryOrderLines(fixture.db)).rejects.toThrow("invalid data");
    await expect(fetchAllRgsFactoryOrderLines(fixture.db, 1001)).rejects.toThrow("Invalid Factory order page size");
  });
});
