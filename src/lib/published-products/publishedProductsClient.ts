import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";
import { buildPublishedOperationalProductIndex } from "./mapPublishedProductProjection";
import type { PublishedOperationalProductIndex, PublishedProductProjectionRow } from "./types";

type PublishedProductsRpc = Database["public"]["Functions"]["published_products_v1"];

/**
 * Canonical read-only operational publication projection for Central.
 * Uses Core `published_products_v1()` — never reads publication gates from `products` directly.
 */
export async function fetchPublishedOperationalProducts(
  supabase: SupabaseClient<Database>,
): Promise<PublishedOperationalProductIndex> {
  const { data, error } = await supabase.rpc("published_products_v1");
  if (error) {
    throw new Error(`published_products_v1 read failed: ${error.message}`);
  }

  const rows = (data ?? []) as PublishedProductsRpc["Returns"];
  return buildPublishedOperationalProductIndex(rows as PublishedProductProjectionRow[]);
}

export function isProductPublishedOperational(
  index: PublishedOperationalProductIndex,
  productId: string | null | undefined,
): boolean {
  if (!productId) return false;
  return index.byProductId.has(productId);
}
