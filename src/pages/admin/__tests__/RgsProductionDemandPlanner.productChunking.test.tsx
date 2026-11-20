import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RgsProductionDemandPlanner, { calculateOpenReservationShortage, readAllOpenRgsReservations } from "../RgsProductionDemandPlanner";

// Focused coverage for the client-side reservation<->product join
// (RgsProductionDemandPlanner.tsx's load()): inventory_reservations carries
// no FK to products, so the join happens in two plain queries merged in
// the browser. This covers:
// 1. the join itself (a reservation resolves to its product's name/department)
// 2. the product-ID chunking (PRODUCT_ID_QUERY_CHUNK_SIZE) that avoids a
//    414 Request-URI Too Large when a single .in() filter would otherwise
//    carry an unbounded UUID array
// 3. reservation release semantics: Core decrements reserved_qty when stock
//    is released, so released_qty must not be subtracted again as coverage.

const PRODUCT_ID_QUERY_CHUNK_SIZE = 100;

function makeQuery(data: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  const resolved = Promise.resolve({ data, error: null });
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.in = () => builder;
  builder.order = () => builder;
  builder.limit = () => resolved;
  builder.range = (from: number, to: number) => Promise.resolve({ data: data.slice(from, to + 1), error: null });
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return builder;
}

function buildReservations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `res-${i}`,
    product_id: `product-${i}`,
    sku: `SKU-${i}`,
    requested_qty: 10,
    reserved_qty: 4,
    fulfilled_qty: 0,
    released_qty: 0,
    reservation_status: "pending",
  }));
}

function buildProducts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `product-${i}`,
    name: `Widget ${i}`,
    production_department: "ARABIC_SWEETS",
  }));
}

const productsInCalls: unknown[][] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (relation: string) => {
      if (relation === "inventory_reservations") {
        return makeQuery(buildReservations(250));
      }
      if (relation === "products") {
        // Return only the products matching whichever chunk was requested,
        // so the test can assert the join actually resolves across chunks.
        return {
          select: () => ({
            in: (_column: string, ids: string[]) => {
              productsInCalls.push(ids);
              const matching = buildProducts(250).filter((p) => ids.includes(p.id));
              return Promise.resolve({ data: matching, error: null });
            },
          }),
        };
      }
      return makeQuery([]);
    },
  },
}));

vi.mock("@/lib/rgsGovernedRpc", () => ({
  rgsGovernedRpc: { rpc: vi.fn(async () => ({ data: null, error: null })) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe("RgsProductionDemandPlanner product-ID chunking", () => {
  afterEach(() => {
    productsInCalls.length = 0;
    vi.clearAllMocks();
  });

  it("chunks the products .in() filter instead of sending all 250 IDs in one request", async () => {
    render(<RgsProductionDemandPlanner />);

    await waitFor(() => {
      expect(screen.getByText("Widget 0")).toBeInTheDocument();
    });

    expect(productsInCalls.length).toBeGreaterThan(1);
    for (const chunk of productsInCalls) {
      expect((chunk as string[]).length).toBeLessThanOrEqual(PRODUCT_ID_QUERY_CHUNK_SIZE);
    }
    const totalIdsRequested = productsInCalls.reduce((sum, chunk) => sum + (chunk as string[]).length, 0);
    expect(totalIdsRequested).toBe(250);
  });

  it("resolves the reservation<->product join correctly across chunk boundaries", async () => {
    render(<RgsProductionDemandPlanner />);

    await waitFor(() => {
      expect(screen.getByText("Widget 0")).toBeInTheDocument();
    });

    // product-149 and product-249 land in different chunks (0-99, 100-199,
    // 200-249); both must resolve correctly, proving the merge across
    // chunk boundaries doesn't drop or misattribute data.
    expect(screen.getByText("Widget 149")).toBeInTheDocument();
    expect(screen.getByText("Widget 249")).toBeInTheDocument();
  });

  it("treats released stock as newly uncovered demand rather than double-counting it as coverage", () => {
    // Core release_rgs_reservation changes reserved_qty 10 -> 8 and
    // released_qty 0 -> 2 in the same transaction. The correct shortage is
    // therefore requested 10 - currently reserved 8 - fulfilled 0 = 2.
    expect(
      calculateOpenReservationShortage({
        requested_qty: 10,
        reserved_qty: 8,
        fulfilled_qty: 0,
        released_qty: 2,
      }),
    ).toBe(2);

    expect(
      calculateOpenReservationShortage({
        requested_qty: 10,
        reserved_qty: 8,
        fulfilled_qty: 2,
        released_qty: 2,
      }),
    ).toBe(0);
  });
  it("reads beyond the 1,000-row PostgREST default without dropping shortage reservations", async () => {
    const reservations = buildReservations(1205);
    const pages: Array<[number, number]> = [];
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (from: number, to: number) => {
        pages.push([from, to]);
        return { data: reservations.slice(from, to + 1), error: null };
      }),
    };
    const client = { from: () => builder } as unknown as Parameters<typeof readAllOpenRgsReservations>[0];

    const rows = await readAllOpenRgsReservations(client);

    expect(rows).toHaveLength(1205);
    expect(rows[0].id).toBe("res-0");
    expect(rows.at(-1)?.id).toBe("res-1204");
    expect(pages).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(builder.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("fails the entire RGS demand read when a later page is unavailable", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (from: number) => from === 0
        ? { data: buildReservations(500), error: null }
        : { data: null, error: { message: "second page unavailable" } }),
    };
    const client = { from: () => builder } as unknown as Parameters<typeof readAllOpenRgsReservations>[0];

    await expect(readAllOpenRgsReservations(client)).rejects.toThrow("second page unavailable");
    expect(builder.range).toHaveBeenCalledTimes(2);
  });

});
