import { describe, expect, it } from "vitest";
import {
  createInMemoryCatalogueConnectorStore,
  intakeApprovedCatalogueSnapshot,
  validateApprovedCatalogueSnapshot,
} from "../index";

function validSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    external_catalogue_product_id: "ext-intake-1",
    sku: "OAS-INTAKE-1",
    product_name: "Intake Test Product",
    category: "Ready Packs",
    hsn_code: "19059090",
    approved_image_urls: ["https://cdn.example.com/img.jpg"],
    status: "active",
    version: 1,
    updated_at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

describe("validateApprovedCatalogueSnapshot", () => {
  it("rejects missing sku, name, and external id", () => {
    const result = validateApprovedCatalogueSnapshot({
      sku: "",
      product_name: "",
      external_catalogue_product_id: "",
      category: "X",
      hsn_code: "1",
      status: "active",
      version: 1,
      updated_at: "2026-06-01T00:00:00Z",
      approved_image_urls: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("sku");
      expect(fields).toContain("product_name");
      expect(fields).toContain("external_catalogue_product_id");
    }
  });

  it("accepts valid snapshot", () => {
    const result = validateApprovedCatalogueSnapshot(validSnapshot());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.sku).toBe("OAS-INTAKE-1");
    }
  });
});

describe("intakeApprovedCatalogueSnapshot", () => {
  it("valid snapshot syncs to store", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const result = await intakeApprovedCatalogueSnapshot(store, validSnapshot());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sync.sync_status).toBe("synced");
      expect(result.sync.product?.created).toBe(true);
      expect(store.mappings).toHaveLength(1);
    }
  });

  it("invalid snapshot rejected without sync side effects", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const result = await intakeApprovedCatalogueSnapshot(store, { sku: "ONLY-SKU" });
    expect(result.ok).toBe(false);
    expect(store.products).toHaveLength(0);
    expect(store.mappings).toHaveLength(0);
  });

  it("stale version skipped on second intake", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    await intakeApprovedCatalogueSnapshot(store, validSnapshot({ version: 2 }));
    const stale = await intakeApprovedCatalogueSnapshot(
      store,
      validSnapshot({ version: 1, product_name: "Should Not Apply" }),
    );
    expect(stale.ok).toBe(true);
    if (stale.ok) {
      expect(stale.sync.sync_status).toBe("skipped_stale");
      expect(store.products[0].name).toBe("Intake Test Product");
    }
  });

  it("inactive snapshot deactivates product", async () => {
    const store = createInMemoryCatalogueConnectorStore();
    const active = await intakeApprovedCatalogueSnapshot(store, validSnapshot({ version: 1 }));
    expect(active.ok).toBe(true);

    const inactive = await intakeApprovedCatalogueSnapshot(
      store,
      validSnapshot({ status: "inactive", version: 2 }),
    );
    expect(inactive.ok).toBe(true);
    if (inactive.ok) {
      expect(inactive.sync.sync_status).toBe("deactivated");
      const row = store.products[0] as unknown as Record<string, unknown>;
      expect(row.is_active).toBe(false);
      expect(row.visible_in_catalog).toBe(false);
    }
  });
});
