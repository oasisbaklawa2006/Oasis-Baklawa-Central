import {
  buildProductInsertFromSnapshot,
  buildProductPatchFromSnapshot,
  isStaleCatalogueVersion,
  normalizeCatalogueSku,
  selectPrimaryImageUrl,
} from "./catalogueConnectorLogic";
import type {
  ApprovedCatalogueProductSnapshot,
  CatalogueSyncResult,
} from "./catalogueConnectorTypes";
import { DEFAULT_CATALOGUE_SOURCE_APP } from "./catalogueConnectorTypes";
import type { CatalogueConnectorStore } from "./catalogueConnectorStore";

export class CatalogueSkuConflictError extends Error {
  constructor(
    public readonly sku: string,
    public readonly existingExternalId: string,
  ) {
    super(`SKU ${sku} is already mapped to external catalogue product ${existingExternalId}`);
    this.name = "CatalogueSkuConflictError";
  }
}

export function createCatalogueConnectorSync(store: CatalogueConnectorStore) {
  return async function syncApprovedCatalogueProduct(
    snapshot: ApprovedCatalogueProductSnapshot,
    sourceApp: string = DEFAULT_CATALOGUE_SOURCE_APP,
  ): Promise<CatalogueSyncResult> {
    const sku = normalizeCatalogueSku(snapshot.sku);
    const externalId = snapshot.external_catalogue_product_id.trim();
    const now = new Date().toISOString();

    if (!externalId) {
      return errorResult(externalId, sku, "external_catalogue_product_id is required");
    }
    if (!sku) {
      return errorResult(externalId, sku, "sku is required");
    }

    try {
      const byExternal = await store.findMappingByExternalId(sourceApp, externalId);
      if (byExternal && isStaleCatalogueVersion(snapshot.version, byExternal.source_version)) {
        const mapping = await store.upsertMapping({
          external_catalogue_product_id: externalId,
          central_product_id: byExternal.central_product_id,
          sku,
          source_app: sourceApp,
          source_version: byExternal.source_version,
          sync_status: "skipped_stale",
          last_synced_at: now,
          metadata: { skipped_reason: "incoming_version_older", incoming_version: snapshot.version },
        });
        return {
          external_catalogue_product_id: externalId,
          sku,
          sync_status: "skipped_stale",
          mapping_id: mapping.id,
        };
      }

      const bySku = await store.findMappingBySku(sourceApp, sku);
      if (bySku && bySku.external_catalogue_product_id !== externalId) {
        throw new CatalogueSkuConflictError(sku, bySku.external_catalogue_product_id);
      }

      let product =
        (snapshot.central_product_id
          ? await store.findProductById(snapshot.central_product_id)
          : null) ??
        (byExternal?.central_product_id
          ? await store.findProductById(byExternal.central_product_id)
          : null) ??
        (await store.findProductBySku(sku));

      const patch = buildProductPatchFromSnapshot({ ...snapshot, sku });
      const imageUrl = selectPrimaryImageUrl(snapshot.approved_image_urls);
      let created = false;

      if (product) {
        product = await store.updateProduct(product.id, patch);
      } else if (snapshot.status === "active") {
        product = await store.insertProduct(buildProductInsertFromSnapshot({ ...snapshot, sku }));
        created = true;
      } else {
        const mapping = await store.upsertMapping({
          external_catalogue_product_id: externalId,
          central_product_id: null,
          sku,
          source_app: sourceApp,
          source_version: snapshot.version,
          sync_status: "deactivated",
          last_synced_at: now,
          metadata: { note: "inactive_snapshot_no_central_product" },
        });
        return {
          external_catalogue_product_id: externalId,
          sku,
          sync_status: "deactivated",
          mapping_id: mapping.id,
        };
      }

      const syncStatus = snapshot.status === "active" ? "synced" : "deactivated";
      const mapping = await store.upsertMapping({
        external_catalogue_product_id: externalId,
        central_product_id: product.id,
        sku,
        source_app: sourceApp,
        source_version: snapshot.version,
        sync_status: syncStatus,
        last_synced_at: now,
        metadata: {
          builder_updated_at: snapshot.updated_at,
          image_count: snapshot.approved_image_urls?.length ?? 0,
        },
      });

      return {
        external_catalogue_product_id: externalId,
        sku,
        sync_status: syncStatus,
        mapping_id: mapping.id,
        product: {
          central_product_id: product.id,
          sku: product.sku,
          created,
          deactivated: snapshot.status === "inactive",
          image_url: imageUrl,
        },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const mapping = await store.upsertMapping({
        external_catalogue_product_id: externalId,
        central_product_id: null,
        sku,
        source_app: sourceApp,
        source_version: snapshot.version,
        sync_status: "error",
        last_synced_at: now,
        metadata: { error: message },
      }).catch(() => null);

      return {
        external_catalogue_product_id: externalId,
        sku,
        sync_status: "error",
        mapping_id: mapping?.id ?? "",
        error: message,
      };
    }
  };
}

function errorResult(externalId: string, sku: string, error: string): CatalogueSyncResult {
  return {
    external_catalogue_product_id: externalId,
    sku,
    sync_status: "error",
    mapping_id: "",
    error,
  };
}
