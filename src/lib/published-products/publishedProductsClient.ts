import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";
import { buildPublishedOperationalProductIndex } from "./mapPublishedProductProjection";
import type { PublishedOperationalProductIndex, PublishedProductProjectionRow } from "./types";

type PublishedProductsRpcResult = {
  data: PublishedProductProjectionRow[] | null;
  error: { message: string } | null;
};

type PublishedProductsRpcClient = {
  rpc: (name: "published_products_v1") => Promise<PublishedProductsRpcResult>;
};

/**
 * Canonical read-only operational publication projection for Central.
 * Uses Core `published_products_v1()` — never reads publication gates from `products` directly.
 *
 * The narrow cast is deliberately local: Central's generated Database type predates this
 * already-deployed Core RPC, and replacing the evolved generated type file with the stale
 * Point55 copy would be unsafe. Regeneration can remove this adapter later without changing
 * the runtime contract.
 */
export async function fetchPublishedOperationalProducts(
  supabase: SupabaseClient<Database>,
): Promise<PublishedOperationalProductIndex> {
  const rpcClient = supabase as unknown as PublishedProductsRpcClient;
  const { data, error } = await rpcClient.rpc("published_products_v1");
  if (error) {
    throw new Error(`published_products_v1 read failed: ${error.message}`);
  }

  return buildPublishedOperationalProductIndex(data ?? []);
}

export function isProductPublishedOperational(
  index: PublishedOperationalProductIndex,
  productId: string | null | undefined,
): boolean {
  if (!productId) return false;
  return index.byProductId.has(productId);
}
