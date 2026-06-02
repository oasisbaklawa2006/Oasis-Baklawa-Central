export type {
  ApprovedCatalogueProductSnapshot,
  CatalogueProductMappingRecord,
  CatalogueSyncResult,
  CatalogueSyncStatus,
} from "./catalogueConnectorTypes";
export { DEFAULT_CATALOGUE_SOURCE_APP } from "./catalogueConnectorTypes";
export {
  buildProductInsertFromSnapshot,
  buildProductPatchFromSnapshot,
  isStaleCatalogueVersion,
  normalizeCatalogueSku,
  selectPrimaryImageUrl,
} from "./catalogueConnectorLogic";
export type { CatalogueConnectorStore } from "./catalogueConnectorStore";
export {
  CatalogueSkuConflictError,
  createCatalogueConnectorSync,
} from "./syncApprovedCatalogueProduct";
export { createInMemoryCatalogueConnectorStore } from "./inMemoryCatalogueConnectorStore";
export { createSupabaseCatalogueConnectorStore } from "./supabaseCatalogueConnectorStore";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCatalogueConnectorSync } from "./syncApprovedCatalogueProduct";
import { createSupabaseCatalogueConnectorStore } from "./supabaseCatalogueConnectorStore";

export function createCatalogueConnectorBundle(client: SupabaseClient) {
  const store = createSupabaseCatalogueConnectorStore(client);
  return {
    store,
    syncApprovedCatalogueProduct: createCatalogueConnectorSync(store),
  };
}
