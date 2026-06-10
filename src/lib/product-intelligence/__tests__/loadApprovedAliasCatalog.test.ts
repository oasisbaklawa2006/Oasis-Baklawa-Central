import { describe, expect, it, vi } from "vitest";
import {
  CATALOG_SELECT_PAGE_SIZE,
  loadApprovedAliasCatalog,
} from "../loadApprovedAliasCatalog";
import type { IntelligenceAliasRow } from "../types";

function makeProductRow(id: string, name: string) {
  return {
    id,
    name,
    sku: `SKU-${id}`,
    pack_size: null,
    net_weight_grams: null,
    uom: null,
    category: null,
    sub_category: null,
    aliases: [] as string[],
  };
}

function makeAliasRow(id: string): IntelligenceAliasRow {
  return {
    alias_text: `alias-${id}`,
    canonical_name: `Product ${id}`,
    product_id: id,
  };
}

function createPagedMock(tableData: Record<string, unknown[]>): {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  rangeCalls: Record<string, number>;
} {
  const rangeCalls: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const rows = tableData[table] ?? [];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (fromIndex: number, toIndex: number) => {
        rangeCalls[table] = (rangeCalls[table] ?? 0) + 1;
        return {
          data: rows.slice(fromIndex, toIndex + 1),
          error: null,
        };
      }),
    };
    return chain;
  });

  return {
    supabase: { from } as unknown as import("@supabase/supabase-js").SupabaseClient,
    from,
    rangeCalls,
  };
}

describe("loadApprovedAliasCatalog", () => {
  it("issues read-only SELECT on product_aliases and products", async () => {
    const { supabase, from } = createPagedMock({
      product_aliases: [
        { alias_text: "Kitta", canonical_name: "Kitta Cashew Bulk", product_id: "p-1" },
      ],
      products: [
        {
          id: "p-1",
          name: "Kitta Cashew Bulk",
          sku: "KITTA-1",
          pack_size: "1 kg",
          net_weight_grams: 1000,
          uom: "Kg",
          category: "Bulk",
          sub_category: null,
          aliases: ["Kitta"],
        },
      ],
    });

    const catalog = await loadApprovedAliasCatalog(supabase);

    expect(from).toHaveBeenCalledWith("product_aliases");
    expect(from).toHaveBeenCalledWith("products");
    expect(catalog.alias_count).toBe(2);
    expect(catalog.catalog_complete).toBe(true);
    expect(catalog.products[0]?.approved_aliases).toContain("Kitta");
  });

  it("paginates across multiple pages until a short page", async () => {
    const aliasRows = Array.from({ length: CATALOG_SELECT_PAGE_SIZE + 25 }, (_, i) =>
      makeAliasRow(`a-${i}`),
    );
    const productRows = Array.from({ length: CATALOG_SELECT_PAGE_SIZE + 10 }, (_, i) =>
      makeProductRow(`p-${i}`, `Product ${i}`),
    );

    const { supabase, rangeCalls } = createPagedMock({
      product_aliases: aliasRows,
      products: productRows,
    });

    const catalog = await loadApprovedAliasCatalog(supabase);

    expect(catalog.aliases).toHaveLength(CATALOG_SELECT_PAGE_SIZE + 25);
    expect(catalog.products).toHaveLength(CATALOG_SELECT_PAGE_SIZE + 10);
    expect(catalog.catalog_complete).toBe(true);
    expect(rangeCalls.product_aliases).toBe(2);
    expect(rangeCalls.products).toBe(2);
  });

  it("throws when a later page fails instead of returning a partial catalogue", async () => {
    const aliasRows = Array.from({ length: CATALOG_SELECT_PAGE_SIZE + 1 }, (_, i) =>
      makeAliasRow(`a-${i}`),
    );

    let aliasPage = 0;
    const from = vi.fn((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(async (fromIndex: number) => {
          if (table === "product_aliases") {
            aliasPage += 1;
            if (aliasPage > 1) {
              return { data: null, error: { message: "timeout" } };
            }
            return {
              data: aliasRows.slice(fromIndex, fromIndex + CATALOG_SELECT_PAGE_SIZE),
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      };
      return chain;
    });

    const supabase = { from } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await expect(loadApprovedAliasCatalog(supabase)).rejects.toThrow(
      /product_aliases read incomplete after/,
    );
  });
});
