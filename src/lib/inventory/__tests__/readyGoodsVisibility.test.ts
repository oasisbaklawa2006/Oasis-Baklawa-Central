import { describe, expect, it } from "vitest";
import {
  buildInventoryVisibilitySummary,
  deriveStoreStockConfidence,
  groupReadyGoodsByStore,
  matchOutletDisplayName,
  normalizeReadyGoodsRows,
} from "@/lib/inventory/readyGoodsVisibility";

describe("normalizeReadyGoodsRows", () => {
  it("treats null quantity as unknown (never fabricates stock)", () => {
    const [r] = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "Baklava tray",
        sku: "BK-1",
        outletLabel: "South Extension",
        quantity: null,
        source: "factory_inventory",
      },
    ]);
    expect(r.quantityKnown).toBe(false);
    expect(r.quantity).toBeNull();
  });

  it("treats NaN as unknown", () => {
    const [r] = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "X",
        sku: null,
        outletLabel: "A",
        quantity: Number.NaN as unknown as number,
        source: "factory_inventory",
      },
    ]);
    expect(r.quantityKnown).toBe(false);
  });

  it("accepts valid numeric quantity", () => {
    const [r] = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "X",
        sku: null,
        outletLabel: "A",
        quantity: 12,
        source: "factory_inventory",
      },
    ]);
    expect(r.quantityKnown).toBe(true);
    expect(r.quantity).toBe(12);
  });
});

describe("groupReadyGoodsByStore", () => {
  it("groups deterministically with sorted product names within a store", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "b",
        productName: "Beta",
        sku: null,
        outletLabel: "Outlet A",
        quantity: 1,
        source: "factory_inventory",
      },
      {
        productId: "a",
        productName: "Alpha",
        sku: null,
        outletLabel: "Outlet A",
        quantity: 2,
        source: "factory_inventory",
      },
    ]);
    const g = groupReadyGoodsByStore(rows);
    expect([...(g.get("Outlet A") ?? []).map((x) => x.productName)]).toEqual(["Alpha", "Beta"]);
  });
});

describe("deriveStoreStockConfidence", () => {
  const outlets = [
    { outletId: "o1", outletName: "South Extension" },
    { outletId: "o2", outletName: "Paschim Vihar" },
  ];

  it("marks manual verification when rows exist but all quantities unknown", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "X",
        sku: null,
        outletLabel: "South Extension",
        quantity: null,
        source: "factory_inventory",
      },
    ]);
    const grouped = groupReadyGoodsByStore(rows);
    const m = deriveStoreStockConfidence(outlets, grouped);
    expect(m.get("o1")?.confidence).toBe("manual_verification_required");
    expect(m.get("o2")?.confidence).toBe("unknown");
  });

  it("marks verified_numeric only when every row has known quantity", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "X",
        sku: null,
        outletLabel: "South Extension",
        quantity: 3,
        source: "factory_inventory",
      },
      {
        productId: "p2",
        productName: "Y",
        sku: null,
        outletLabel: "South Extension",
        quantity: 10,
        source: "factory_inventory",
      },
    ]);
    const grouped = groupReadyGoodsByStore(rows);
    const m = deriveStoreStockConfidence(outlets, grouped);
    expect(m.get("o1")?.confidence).toBe("verified_numeric");
  });
});

describe("buildInventoryVisibilitySummary", () => {
  it("prefers factory_inventory as primary source when present", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "X",
        sku: null,
        outletLabel: "South Extension",
        quantity: 1,
        source: "factory_inventory",
      },
    ]);
    const outlets = [{ outletId: "o1", outletName: "South Extension" }];
    const grouped = groupReadyGoodsByStore(rows);
    const s = buildInventoryVisibilitySummary(rows, outlets, grouped);
    expect(s.primarySource).toBe("factory_inventory");
    expect(s.outletsWithData).toBe(1);
  });
});

describe("matchOutletDisplayName", () => {
  it("matches canonical outlet names case-insensitively", () => {
    expect(matchOutletDisplayName("south extension", ["South Extension", "Paschim Vihar"])).toBe("South Extension");
  });

  it("returns null when nothing matches", () => {
    expect(matchOutletDisplayName("unknown depot", ["South Extension"])).toBeNull();
  });
});
