import { describe, expect, it, vi } from "vitest";
import { loadApprovedAliasCatalog } from "../loadApprovedAliasCatalog";

describe("loadApprovedAliasCatalog", () => {
  it("issues read-only SELECT on product_aliases and products", async () => {
    const from = vi.fn((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data:
            table === "product_aliases"
              ? [{ alias_text: "Kitta", canonical_name: "Kitta Cashew Bulk", product_id: "p-1" }]
              : [
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
          error: null,
        }),
      };
      return chain;
    });

    const supabase = { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const catalog = await loadApprovedAliasCatalog(supabase);

    expect(from).toHaveBeenCalledWith("product_aliases");
    expect(from).toHaveBeenCalledWith("products");
    expect(catalog.alias_count).toBe(1);
    expect(catalog.products[0]?.approved_aliases).toContain("Kitta");
  });
});
