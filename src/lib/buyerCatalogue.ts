import type { Tables } from "@/integrations/supabase/types";

export type BuyerCatalogueProduct = Pick<Tables<"products">, "is_active" | "visible_in_catalog">;

/** Buyer storefront catalogue: both flags must be explicitly true. */
export function isBuyerVisibleProduct(product: BuyerCatalogueProduct): boolean {
  return product.is_active === true && product.visible_in_catalog === true;
}
