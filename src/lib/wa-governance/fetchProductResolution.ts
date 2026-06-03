import type { SupabaseClient } from "@supabase/supabase-js";
import {
  postgrestIlikeContainsPattern,
  postgrestOrIlikeContains,
} from "./clientResolutionIlike";
import { isIdentityAlias } from "./productResolutionAliasPolicy";
import { extractProductResolutionTextSignals } from "./productResolutionSignals";
import { scoreProductResolutionCandidates } from "./productResolutionScoring";
import type {
  ProductAliasRow,
  ProductResolutionInput,
  ProductResolutionResult,
  ProductResolutionRow,
} from "./productResolutionTypes";

const PRODUCT_SELECT =
  "id, name, sku, aliases, pack_size, net_weight_grams, avg_weight_per_pack, primary_pack_weight_kg, uom, category, sub_category";

function dedupeProducts(rows: ProductResolutionRow[]): ProductResolutionRow[] {
  const map = new Map<string, ProductResolutionRow>();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

async function queryProductsByName(
  supabase: SupabaseClient,
  term: string,
): Promise<ProductResolutionRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .ilike("name", postgrestIlikeContainsPattern(term))
    .limit(5);
  if (error || !data) return [];
  return data as ProductResolutionRow[];
}

async function queryProductsBySku(
  supabase: SupabaseClient,
  term: string,
): Promise<ProductResolutionRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .ilike("sku", postgrestIlikeContainsPattern(term))
    .limit(3);
  if (error || !data) return [];
  return data as ProductResolutionRow[];
}

async function queryProductsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<ProductResolutionRow[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", uniqueIds)
    .eq("is_active", true)
    .limit(20);
  if (error || !data) return [];
  return data as ProductResolutionRow[];
}

async function queryProductAliases(
  supabase: SupabaseClient,
  term: string,
): Promise<ProductAliasRow[]> {
  const { data, error } = await supabase
    .from("product_aliases")
    .select("alias_text, canonical_name, product_id")
    .ilike("alias_text", postgrestIlikeContainsPattern(term))
    .limit(5);
  if (error || !data) return [];
  return data as ProductAliasRow[];
}

async function queryProductsByKeyword(
  supabase: SupabaseClient,
  keyword: string,
): Promise<ProductResolutionRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .or(
      `${postgrestOrIlikeContains("name", keyword)},${postgrestOrIlikeContains("category", keyword)},${postgrestOrIlikeContains("sub_category", keyword)},${postgrestOrIlikeContains("pack_size", keyword)}`,
    )
    .limit(5);
  if (error || !data) return [];
  return (data as ProductResolutionRow[]).filter((row) =>
    [row.name, row.category, row.sub_category, row.pack_size]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(keyword.toLowerCase())),
  );
}

/**
 * Read-only product resolution for operator inbox (WA-05A).
 * SELECT-only queries on products and product_aliases; no mutations.
 */
export async function resolveProductCandidates(
  supabase: SupabaseClient,
  input: ProductResolutionInput,
): Promise<ProductResolutionResult> {
  const signals = extractProductResolutionTextSignals(
    input.messageText,
    input.stitchedPlainText,
  );

  const collected: ProductResolutionRow[] = [];
  const aliasHits = new Map<string, string[]>();

  function absorb(rows: ProductResolutionRow[]): void {
    collected.push(...rows);
  }

  function noteAlias(productId: string, alias: string): void {
    if (!isIdentityAlias(alias)) return;
    const list = aliasHits.get(productId) ?? [];
    if (!list.includes(alias)) list.push(alias);
    aliasHits.set(productId, list);
  }

  for (const term of signals.productNameCandidates.slice(0, 6)) {
    absorb(await queryProductsByName(supabase, term));
    absorb(await queryProductsBySku(supabase, term));
    const aliasRows = await queryProductAliases(supabase, term);
    for (const aliasRow of aliasRows) {
      if (aliasRow.product_id) noteAlias(aliasRow.product_id, aliasRow.alias_text);
      absorb(await queryProductsByName(supabase, aliasRow.canonical_name));
    }
  }

  for (const keyword of signals.catalogKeywords.slice(0, 4)) {
    absorb(await queryProductsByKeyword(supabase, keyword));
  }

  const aliasProductIds = [...aliasHits.keys()];
  absorb(await queryProductsByIds(supabase, aliasProductIds));

  const products = dedupeProducts(collected);
  return scoreProductResolutionCandidates({
    signals,
    products,
    aliasHits,
  });
}

export async function fetchProductResolution(
  supabase: SupabaseClient,
  input: ProductResolutionInput,
): Promise<ProductResolutionResult> {
  return resolveProductCandidates(supabase, input);
}
