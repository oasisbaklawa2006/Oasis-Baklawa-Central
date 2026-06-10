import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovedAliasCatalog, IntelligenceAliasRow, IntelligenceProductRow } from "./types";

const PRODUCT_SELECT =
  "id, name, sku, pack_size, net_weight_grams, uom, category, sub_category, aliases";

function mergeProductAliases(
  product: IntelligenceProductRow,
  aliasRows: IntelligenceAliasRow[],
): string[] {
  const set = new Set<string>();
  for (const a of product.approved_aliases) {
    const t = a.trim();
    if (t) set.add(t);
  }
  for (const row of aliasRows) {
    if (row.product_id !== product.id) continue;
    if (row.alias_text.trim()) set.add(row.alias_text.trim());
    if (row.canonical_name.trim()) set.add(row.canonical_name.trim());
  }
  return [...set];
}

function countLoadedAliasEntries(
  aliasRows: IntelligenceAliasRow[],
  productsRaw: Array<{ aliases: string[] | null }>,
): number {
  const productAliasEntries = productsRaw.reduce(
    (sum, row) => sum + (row.aliases ?? []).filter((alias) => alias.trim()).length,
    0,
  );
  return aliasRows.length + productAliasEntries;
}

/**
 * Read-only load of approved language intelligence from Central.
 * SELECT on `product_aliases` and `products` only — no mutations.
 */
export async function loadApprovedAliasCatalog(
  supabase: SupabaseClient,
): Promise<ApprovedAliasCatalog> {
  const [aliasResult, productResult] = await Promise.all([
    supabase
      .from("product_aliases")
      .select("alias_text, canonical_name, product_id")
      .order("alias_text"),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (aliasResult.error) {
    throw new Error(`product_aliases read failed: ${aliasResult.error.message}`);
  }
  if (productResult.error) {
    throw new Error(`products read failed: ${productResult.error.message}`);
  }

  const aliases = (aliasResult.data ?? []) as IntelligenceAliasRow[];
  const productsRaw = (productResult.data ?? []) as Array<
    Omit<IntelligenceProductRow, "approved_aliases"> & { aliases: string[] | null }
  >;

  const products: IntelligenceProductRow[] = productsRaw.map((row) => {
    const base: IntelligenceProductRow = {
      id: row.id,
      name: row.name,
      sku: row.sku,
      pack_size: row.pack_size,
      net_weight_grams: row.net_weight_grams,
      uom: row.uom,
      category: row.category,
      sub_category: row.sub_category,
      approved_aliases: row.aliases ?? [],
    };
    return {
      ...base,
      approved_aliases: mergeProductAliases(base, aliases),
    };
  });

  return {
    products,
    aliases,
    loaded_at: new Date().toISOString(),
    product_count: products.length,
    alias_count: countLoadedAliasEntries(aliases, productsRaw),
  };
}
