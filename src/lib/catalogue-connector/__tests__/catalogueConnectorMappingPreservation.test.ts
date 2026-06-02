import { describe, expect, it, vi } from "vitest";
import {
  CatalogueSkuConflictError,
  createCatalogueConnectorSync,
  createInMemoryCatalogueConnectorStore,
} from "../index";
import type { ApprovedCatalogueProductSnapshot } from "../catalogueConnectorTypes";
import type { CatalogueConnectorStore } from "../catalogueConnectorStore";

function baseSnapshot(
  overrides: Partial<ApprovedCatalogueProductSnapshot> = {},
): ApprovedCatalogueProductSnapshot {
  return {
    external_catalogue_product_id: "ext-001",
    sku: "OAS-PUR-1",
    product_name: "Premium Baklawa Pack",
    product_description: "Approved description",
    approved_image_urls: ["https://cdn.example.com/p1.jpg"],
    mrp: 500,
    base_price: 400,
    pack_size: "500g",
    category: "Ready Packs",
    hsn_code: "19059090",
    gst_rate: 5,
    uom: "Pc",
    status: "active",
    version: 1,
    updated_at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

function storeWithFailingUpdate(
  base: ReturnType<typeof createInMemoryCatalogueConnectorStore>,
  failOnUpdate = true,
): CatalogueConnectorStore {
  return {
    ...base,
    updateProduct: vi.fn(async (productId, patch) => {
      if (failOnUpdate) {
        throw new Error("simulated product update failure");
      }
      return base.updateProduct(productId, patch);
    }),
  };
}

describe("catalogue connector mapping preservation", () => {
  it("newer sync creates mapping with incoming sku and version", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    const result = await sync(baseSnapshot({ version: 1, sku: "OAS-NEW-1" }));
    expect(result.sync_status).toBe("synced");
    expect(store.mappings).toHaveLength(1);
    expect(store.mappings[0].sku).toBe("OAS-NEW-1");
    expect(store.mappings[0].source_version).toBe(1);
    expect(store.mappings[0].central_product_id).toBeTruthy();
  });

  it("stale older snapshot does not change existing sku", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-stale",
        sku: "OAS-CURRENT",
        version: 3,
      }),
    );

    const stale = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-stale",
        sku: "OAS-STALE-WRONG",
        version: 1,
      }),
    );

    expect(stale.sync_status).toBe("skipped_stale");
    expect(stale.sku).toBe("OAS-CURRENT");
    expect(store.mappings[0].sku).toBe("OAS-CURRENT");
  });

  it("stale older snapshot does not change central_product_id", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    const first = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-stale-pid",
        sku: "OAS-KEEP-PID",
        version: 2,
      }),
    );
    const productId = first.product!.central_product_id;

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-stale-pid",
        sku: "OAS-OTHER",
        version: 1,
        central_product_id: null,
      }),
    );

    expect(store.mappings[0].central_product_id).toBe(productId);
  });

  it("stale older snapshot does not advance source_version", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-ver",
        sku: "OAS-VER",
        version: 5,
      }),
    );

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-ver",
        sku: "OAS-VER-OLD",
        version: 2,
      }),
    );

    expect(store.mappings[0].source_version).toBe(5);
    expect(store.mappings[0].sync_status).toBe("skipped_stale");
  });

  it("stale older snapshot does not throw when incoming sku belongs to another mapping", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-other",
        sku: "OAS-TAKEN",
        version: 1,
      }),
    );

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-primary",
        sku: "OAS-PRIMARY",
        version: 3,
      }),
    );

    const stale = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-primary",
        sku: "OAS-TAKEN",
        version: 1,
      }),
    );

    expect(stale.sync_status).toBe("skipped_stale");
    expect(store.mappings.find((m) => m.external_catalogue_product_id === "ext-primary")?.sku).toBe(
      "OAS-PRIMARY",
    );
    expect(store.mappings).toHaveLength(2);
  });

  it("failed sync after good mapping preserves central_product_id", async () => {
    const base = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(storeWithFailingUpdate(base));

    const first = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-fail",
        sku: "OAS-FAIL-1",
        version: 1,
      }),
    );
    const productId = first.product!.central_product_id;

    const failed = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-fail",
        sku: "OAS-FAIL-1",
        version: 2,
        product_name: "Should fail on update",
      }),
    );

    expect(failed.sync_status).toBe("error");
    expect(base.mappings[0].central_product_id).toBe(productId);
  });

  it("failed sync after good mapping does not advance source_version", async () => {
    const base = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(storeWithFailingUpdate(base));

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-fail-ver",
        sku: "OAS-FV",
        version: 4,
      }),
    );

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-fail-ver",
        sku: "OAS-FV",
        version: 9,
      }),
    );

    expect(base.mappings[0].source_version).toBe(4);
  });

  it("failed sync records error metadata and status without destroying mapping sku", async () => {
    const base = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(storeWithFailingUpdate(base));

    await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-meta",
        sku: "OAS-META",
        version: 2,
      }),
    );

    const failed = await sync(
      baseSnapshot({
        external_catalogue_product_id: "ext-meta",
        sku: "OAS-META-BAD",
        version: 3,
      }),
    );

    expect(failed.sync_status).toBe("error");
    expect(failed.error).toContain("simulated product update failure");
    expect(base.mappings[0].sku).toBe("OAS-META");
    expect(base.mappings[0].sync_status).toBe("error");
    expect(base.mappings[0].metadata.error).toContain("simulated product update failure");
    expect(base.mappings[0].metadata.failed_incoming_version).toBe(3);
  });

  it("SKU conflict does not upsert a conflicting error mapping for a new external id", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    await sync(baseSnapshot({ sku: "OAS-DUP", external_catalogue_product_id: "ext-1" }));

    const conflict = await sync(
      baseSnapshot({ sku: "OAS-DUP", external_catalogue_product_id: "ext-2", version: 1 }),
    );

    expect(conflict.sync_status).toBe("error");
    expect(conflict.error).toContain("ext-1");
    expect(store.mappings).toHaveLength(1);
    expect(store.mappings[0].external_catalogue_product_id).toBe("ext-1");
  });
});

describe("CatalogueSkuConflictError", () => {
  it("is instanceof Error", () => {
    expect(new CatalogueSkuConflictError("A", "b")).toBeInstanceOf(CatalogueSkuConflictError);
  });
});
