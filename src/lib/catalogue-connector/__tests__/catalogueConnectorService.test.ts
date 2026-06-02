import { describe, expect, it } from "vitest";
import {
  createCatalogueConnectorSync,
  createInMemoryCatalogueConnectorStore,
  selectPrimaryImageUrl,
  CatalogueSkuConflictError,
} from "../index";
import type { ApprovedCatalogueProductSnapshot } from "../catalogueConnectorTypes";

function baseSnapshot(
  overrides: Partial<ApprovedCatalogueProductSnapshot> = {},
): ApprovedCatalogueProductSnapshot {
  return {
    external_catalogue_product_id: "ext-001",
    sku: "OAS-PUR-1",
    product_name: "Premium Baklava Pack",
    product_description: "Approved description",
    approved_image_urls: ["https://cdn.example.com/p1.jpg", ""],
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

describe("catalogue connector", () => {
  it("selectPrimaryImageUrl picks first https URL", () => {
    expect(selectPrimaryImageUrl(["", "https://a.com/1.png", "https://b.com/2.png"])).toBe(
      "https://a.com/1.png",
    );
  });

  it("idempotent sync updates same product without duplicate rows", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);
    const snap = baseSnapshot();

    const first = await sync(snap);
    expect(first.sync_status).toBe("synced");
    expect(first.product?.created).toBe(true);
    expect(store.products).toHaveLength(1);

    const second = await sync({ ...snap, version: 2, product_name: "Renamed Pack" });
    expect(second.sync_status).toBe("synced");
    expect(second.product?.created).toBe(false);
    expect(store.products).toHaveLength(1);
    expect(store.products[0].name).toBe("Renamed Pack");
    expect(store.mappings).toHaveLength(1);
  });

  it("SKU update does not duplicate product when remapping same external id", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    const first = await sync(baseSnapshot({ sku: "OAS-A-1", external_catalogue_product_id: "ext-a" }));
    const productId = first.product!.central_product_id;

    const second = await sync(
      baseSnapshot({
        sku: "OAS-A-1",
        external_catalogue_product_id: "ext-a",
        central_product_id: productId,
        version: 2,
      }),
    );
    expect(store.products).toHaveLength(1);
    expect(second.product?.central_product_id).toBe(productId);
  });

  it("rejects duplicate SKU for different external catalogue ids", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    await sync(baseSnapshot({ sku: "OAS-DUP", external_catalogue_product_id: "ext-1" }));

    const conflict = await sync(
      baseSnapshot({ sku: "OAS-DUP", external_catalogue_product_id: "ext-2", version: 1 }),
    );
    expect(conflict.sync_status).toBe("error");
    expect(conflict.error).toContain("ext-1");
    expect(store.products).toHaveLength(1);
  });

  it("inactive external product deactivates and hides Central product", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    const active = await sync(baseSnapshot());
    const productId = active.product!.central_product_id;

    const inactive = await sync(
      baseSnapshot({
        status: "inactive",
        version: 2,
        central_product_id: productId,
      }),
    );
    expect(inactive.sync_status).toBe("deactivated");
    expect(inactive.product?.deactivated).toBe(true);
    const productRow = store.products[0] as unknown as Record<string, unknown>;
    expect(productRow.is_active).toBe(false);
    expect(productRow.visible_in_catalog).toBe(false);
    expect(store.products).toHaveLength(1);
  });

  it("maps external id to central product id and sets image_url", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const sync = createCatalogueConnectorSync(store);

    const result = await sync(baseSnapshot({ external_catalogue_product_id: "builder-uuid-99" }));
    expect(result.mapping_id).toBeTruthy();
    expect(result.product?.image_url).toBe("https://cdn.example.com/p1.jpg");
    expect(store.mappings[0].external_catalogue_product_id).toBe("builder-uuid-99");
    expect(store.mappings[0].central_product_id).toBe(result.product?.central_product_id);
    expect((store.products[0] as unknown as Record<string, unknown>).image_url).toBe(
      "https://cdn.example.com/p1.jpg",
    );
  });
});

describe("CatalogueSkuConflictError", () => {
  it("exposes sku and existing external id", () => {
    const err = new CatalogueSkuConflictError("OAS-1", "ext-old");
    expect(err.sku).toBe("OAS-1");
    expect(err.existingExternalId).toBe("ext-old");
  });
});
