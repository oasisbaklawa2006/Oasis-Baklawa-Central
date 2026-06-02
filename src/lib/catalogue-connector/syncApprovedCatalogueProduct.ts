import {
  buildProductInsertFromSnapshot,
  buildProductPatchFromSnapshot,
  isStaleCatalogueVersion,
  normalizeCatalogueSku,
  selectPrimaryImageUrl,
} from "./catalogueConnectorLogic";
import type {
  ApprovedCatalogueProductSnapshot,
  CatalogueProductMappingRecord,
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

function preservedMappingIdentity(mapping: CatalogueProductMappingRecord) {
  return {
    central_product_id: mapping.central_product_id,
    sku: mapping.sku,
    source_version: mapping.source_version,
  };
}

export function createCatalogueConnectorSync(store: CatalogueConnectorStore) {
  return async function syncApprovedCatalogueProduct(
    snapshot: ApprovedCatalogueProductSnapshot,
    sourceApp: string = DEFAULT_CATALOGUE_SOURCE_APP,
  ): Promise<CatalogueSyncResult> {
    const incomingSku = normalizeCatalogueSku(snapshot.sku);
    const externalId = snapshot.external_catalogue_product_id.trim();
    const now = new Date().toISOString();

    if (!externalId) {
      return errorResult(externalId, incomingSku, "external_catalogue_product_id is required");
    }
    if (!incomingSku) {
      return errorResult(externalId, incomingSku, "sku is required");
    }

    let existingMapping = await store.findMappingByExternalId(sourceApp, externalId);

    try {
      if (
        existingMapping &&
        isStaleCatalogueVersion(snapshot.version, existingMapping.source_version)
      ) {
        return handleStaleSnapshot(
          store,
          existingMapping,
          externalId,
          sourceApp,
          snapshot.version,
          now,
        );
      }

      const bySku = await store.findMappingBySku(sourceApp, incomingSku);
      if (bySku && bySku.external_catalogue_product_id !== externalId) {
        throw new CatalogueSkuConflictError(incomingSku, bySku.external_catalogue_product_id);
      }

      let product =
        (snapshot.central_product_id
          ? await store.findProductById(snapshot.central_product_id)
          : null) ??
        (existingMapping?.central_product_id
          ? await store.findProductById(existingMapping.central_product_id)
          : null) ??
        (await store.findProductBySku(incomingSku));

      const patch = buildProductPatchFromSnapshot({ ...snapshot, sku: incomingSku });
      const imageUrl = selectPrimaryImageUrl(snapshot.approved_image_urls);
      let created = false;

      if (product) {
        product = await store.updateProduct(product.id, patch);
      } else if (snapshot.status === "active") {
        product = await store.insertProduct(
          buildProductInsertFromSnapshot({ ...snapshot, sku: incomingSku }),
        );
        created = true;
      } else {
        const mapping = await store.upsertMapping({
          external_catalogue_product_id: externalId,
          central_product_id: null,
          sku: incomingSku,
          source_app: sourceApp,
          source_version: snapshot.version,
          sync_status: "deactivated",
          last_synced_at: now,
          metadata: { note: "inactive_snapshot_no_central_product" },
        });
        existingMapping = mapping;
        return {
          external_catalogue_product_id: externalId,
          sku: incomingSku,
          sync_status: "deactivated",
          mapping_id: mapping.id,
        };
      }

      const syncStatus = snapshot.status === "active" ? "synced" : "deactivated";
      const mapping = await store.upsertMapping({
        external_catalogue_product_id: externalId,
        central_product_id: product.id,
        sku: incomingSku,
        source_app: sourceApp,
        source_version: snapshot.version,
        sync_status: syncStatus,
        last_synced_at: now,
        metadata: {
          builder_updated_at: snapshot.updated_at,
          image_count: snapshot.approved_image_urls?.length ?? 0,
        },
      });
      existingMapping = mapping;

      return {
        external_catalogue_product_id: externalId,
        sku: incomingSku,
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

      if (e instanceof CatalogueSkuConflictError) {
        return {
          external_catalogue_product_id: externalId,
          sku: existingMapping?.sku ?? incomingSku,
          sync_status: "error",
          mapping_id: existingMapping?.id ?? "",
          error: message,
        };
      }

      if (existingMapping) {
        const mapping = await store
          .upsertMapping({
            external_catalogue_product_id: externalId,
            ...preservedMappingIdentity(existingMapping),
            source_app: sourceApp,
            sync_status: "error",
            last_synced_at: now,
            metadata: {
              ...existingMapping.metadata,
              error: message,
              failed_incoming_version: snapshot.version,
            },
          })
          .catch(() => null);

        return {
          external_catalogue_product_id: externalId,
          sku: existingMapping.sku,
          sync_status: "error",
          mapping_id: mapping?.id ?? existingMapping.id,
          error: message,
        };
      }

      const mapping = await store
        .upsertMapping({
          external_catalogue_product_id: externalId,
          central_product_id: null,
          sku: incomingSku,
          source_app: sourceApp,
          source_version: snapshot.version,
          sync_status: "error",
          last_synced_at: now,
          metadata: { error: message },
        })
        .catch(() => null);

      return {
        external_catalogue_product_id: externalId,
        sku: incomingSku,
        sync_status: "error",
        mapping_id: mapping?.id ?? "",
        error: message,
      };
    }
  };
}

async function handleStaleSnapshot(
  store: CatalogueConnectorStore,
  existingMapping: CatalogueProductMappingRecord,
  externalId: string,
  sourceApp: string,
  incomingVersion: number,
  now: string,
): Promise<CatalogueSyncResult> {
  const preserved = preservedMappingIdentity(existingMapping);

  if (existingMapping.sync_status === "skipped_stale") {
    return {
      external_catalogue_product_id: externalId,
      sku: preserved.sku,
      sync_status: "skipped_stale",
      mapping_id: existingMapping.id,
    };
  }

  const mapping = await store.upsertMapping({
    external_catalogue_product_id: externalId,
    ...preserved,
    source_app: sourceApp,
    sync_status: "skipped_stale",
    last_synced_at: now,
    metadata: {
      ...existingMapping.metadata,
      skipped_reason: "incoming_version_older",
      incoming_version: incomingVersion,
    },
  });

  return {
    external_catalogue_product_id: externalId,
    sku: preserved.sku,
    sync_status: "skipped_stale",
    mapping_id: mapping.id,
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
