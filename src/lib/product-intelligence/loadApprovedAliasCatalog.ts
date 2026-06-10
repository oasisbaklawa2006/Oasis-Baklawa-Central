import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovedAliasCatalog, IntelligenceAliasRow, IntelligenceProductRow } from "./types";

const PRODUCT_SELECT =
  "id, name, sku, pack_size, net_weight_grams, uom, category, sub_category, aliases";

/** PostgREST default max rows is 1000; page below that and fetch until a short page. */
export const CATALOG_SELECT_PAGE_SIZE = 900;

type PagedResult<T> = { data: T[] | null; error: { message: string } | null };

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

async function fetchAllPagedRows<T>(
  label: string,
  queryPage: (from: number, to: number) => Promise<PagedResult<T>>,
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + CATALOG_SELECT_PAGE_SIZE - 1;
    const { data, error } = await queryPage(from, to);

    if (error) {
      if (from > 0) {
        throw new Error(
          `${label} read incomplete after ${rows.length} rows (catalog truncated): ${error.message}`,
        );
      }
      throw new Error(`${label} read failed: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < CATALOG_SELECT_PAGE_SIZE) {
      return { rows, complete: true };
    }

    from += CATALOG_SELECT_PAGE_SIZE;
  }
}

/**
 * Read-only load of approved language intelligence from Central.
 * SELECT on `product_aliases` and `products` only — no mutations.
 */
export async function loadApprovedAliasCatalog(
  supabase: SupabaseClient,
): Promise<ApprovedAliasCatalog> {
  const [aliasLoad, productLoad] = await Promise.all([
    fetchAllPagedRows<IntelligenceAliasRow>("product_aliases", async (from, to) =>
      supabase
        .from("product_aliases")
        .select("alias_text, canonical_name, product_id")
        .order("alias_text")
        .range(from, to),
    ),
    fetchAllPagedRows<
      Omit<IntelligenceProductRow, "approved_aliases"> & { aliases: string[] | null }
    >("products", async (from, to) =>
      supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_active", true)
        .order("name")
        .range(from, to),
    ),
  ]);

  const aliases = aliasLoad.rows;
  const productsRaw = productLoad.rows;
  const catalog_complete = aliasLoad.complete && productLoad.complete;

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
    catalog_complete,
  };
}
