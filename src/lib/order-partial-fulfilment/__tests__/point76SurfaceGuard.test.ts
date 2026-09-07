import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blockLegacyPartialSplitMutation,
  isShadowOrderLineSplitMutation,
} from "../legacyPartialSplitGuard";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("legacyPartialSplitGuard (Point 76)", () => {
  it("blocks shadow order line split mutations", () => {
    expect(
      isShadowOrderLineSplitMutation({
        mutatesOrderItemQuantity: true,
      }),
    ).toBe(true);
    expect(
      isShadowOrderLineSplitMutation({
        insertsShadowOrderItem: true,
      }),
    ).toBe(true);
    expect(
      isShadowOrderLineSplitMutation({
        mutatesFactoryInventory: true,
        adjustmentType: "smart_fulfillment",
      }),
    ).toBe(true);
  });

  it("returns a stable blocked payload", () => {
    const block = blockLegacyPartialSplitMutation("AdminOperations.handleSmartSplit");
    expect(block.blocked).toBe(true);
    expect(block.message).toContain("Core facts/RPCs");
  });
});

describe("Point 76 surface guard — no client-only split mutations", () => {
  it("Order Trace mounts governed partial fulfilment projection panel", () => {
    const traceSheet = source("src/components/admin/OrderTraceSheet.tsx");
    const panel = source("src/components/admin/PartialFulfilmentPanel.tsx");
    expect(traceSheet).toContain("PartialFulfilmentPanel");
    expect(panel).toContain('data-point="76"');
  });

  it("AdminOperations no longer performs smart-split shadow fulfilment mutations", () => {
    const page = source("src/pages/admin/AdminOperations.tsx");
    expect(page).toContain("blockLegacyPartialSplitMutation");
    expect(page).not.toMatch(/\.update\(\{ quantity: remainingQtyToBake \}\)/);
    expect(page).not.toMatch(/adjustment_type:\s*["']smart_fulfillment["']/);
    expect(page).not.toContain("handleSmartSplit");
  });

  it("AdminOperations does not mutate factory_inventory for smart fulfilment", () => {
    const page = source("src/pages/admin/AdminOperations.tsx");
    expect(page).not.toMatch(/from\(["']factory_inventory["']\)\.update/);
  });
});
