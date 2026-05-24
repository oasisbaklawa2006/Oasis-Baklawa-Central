import { describe, expect, it } from "vitest";
import { buildInventoryOperationalFeed } from "@/lib/operational-events/inventoryFeed";
import { normalizeReadyGoodsRows } from "@/lib/inventory/readyGoodsVisibility";

describe("buildInventoryOperationalFeed", () => {
  it("uses warning severity when fetch fails", () => {
    const events = buildInventoryOperationalFeed({
      rows: [],
      outletSummaries: [],
      fetchError: "network",
      declaredSource: "factory_inventory",
      nowMs: 0,
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("inventory.ready_goods_pending");
    expect(events[0].severity).toBe("warning");
    expect(events[0].occurredAt).toBeNull();
  });

  it("emits ready_goods_pending when no rows (no fake stock)", () => {
    const events = buildInventoryOperationalFeed({
      rows: [],
      outletSummaries: [{ outletId: "o1", outletName: "South Extension", rowCount: 0, knownQtyCount: 0, unknownQtyCount: 0, lowStockCount: 0, confidence: "unknown", maxKnownQty: null }],
      fetchError: null,
      declaredSource: "factory_inventory",
      nowMs: 0,
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("inventory.ready_goods_pending");
  });

  it("emits visibility_available when rows exist", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "SKU A",
        sku: "A",
        outletLabel: "South Extension",
        quantity: 4,
        source: "factory_inventory",
      },
    ]);
    const events = buildInventoryOperationalFeed({
      rows,
      outletSummaries: [
        {
          outletId: "o1",
          outletName: "South Extension",
          rowCount: 1,
          knownQtyCount: 1,
          unknownQtyCount: 0,
          lowStockCount: 0,
          confidence: "verified_numeric",
          maxKnownQty: 4,
        },
      ],
      fetchError: null,
      declaredSource: "factory_inventory",
      nowMs: 0,
    });
    expect(events.some((e) => e.kind === "inventory.visibility_available")).toBe(true);
  });

  it("uses warning for manual_verification_required outlet summaries", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "SKU A",
        sku: "A",
        outletLabel: "South Extension",
        quantity: null,
        source: "factory_inventory",
      },
    ]);
    const events = buildInventoryOperationalFeed({
      rows,
      outletSummaries: [
        {
          outletId: "o1",
          outletName: "South Extension",
          rowCount: 1,
          knownQtyCount: 0,
          unknownQtyCount: 1,
          lowStockCount: 0,
          confidence: "manual_verification_required",
          maxKnownQty: null,
        },
      ],
      fetchError: null,
      declaredSource: "factory_inventory",
      nowMs: 0,
    });
    const manual = events.find((e) => e.kind === "inventory.manual_verification_required");
    expect(manual).toBeDefined();
    expect(manual!.severity).toBe("warning");
  });

  it("uses warning severity for partial visibility", () => {
    const rows = normalizeReadyGoodsRows([
      {
        productId: "p1",
        productName: "A",
        sku: null,
        outletLabel: "South Extension",
        quantity: 1,
        source: "factory_inventory",
      },
      {
        productId: "p2",
        productName: "B",
        sku: null,
        outletLabel: "South Extension",
        quantity: null,
        source: "factory_inventory",
      },
    ]);
    const events = buildInventoryOperationalFeed({
      rows,
      outletSummaries: [
        {
          outletId: "o1",
          outletName: "South Extension",
          rowCount: 2,
          knownQtyCount: 1,
          unknownQtyCount: 1,
          lowStockCount: 0,
          confidence: "partial",
          maxKnownQty: 1,
        },
      ],
      fetchError: null,
      declaredSource: "factory_inventory",
      nowMs: 0,
    });
    const partial = events.find((e) => e.id === "inv:outlet:o1:partial");
    expect(partial?.severity).toBe("warning");
  });
});
