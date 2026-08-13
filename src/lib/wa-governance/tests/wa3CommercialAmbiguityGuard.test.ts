import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webhook = fs.readFileSync(path.resolve(process.cwd(), "supabase/functions/whatsapp-webhook/index.ts"), "utf8");
const suggested = fs.readFileSync(path.resolve(process.cwd(), "src/components/warroom/SuggestedOrdersTab.tsx"), "utf8");

describe("WA-3 executable ambiguity guards", () => {
  it("never defaults an unknown WhatsApp quantity to one", () => {
    const parser = webhook.match(/function parseQuantity\([\s\S]*?\n}\n/)?.[0] ?? "";
    const aiMapper = webhook.match(/const parsedItems[\s\S]*?return \{ items: mappedItems/)?.[0] ?? "";
    expect(parser).toContain("quantity > 0 ? quantity : null");
    expect(parser).toMatch(/return null;\s*}\s*$/);
    expect(aiMapper).toContain('typeof item.quantity === "number"');
    expect(aiMapper).not.toMatch(/Number\(item\.quantity\)/);
    expect(webhook).not.toContain("default to 1");
  });

  it("does not create a direct draft solely from order intent without resolved lines", () => {
    expect(webhook).not.toContain("orderItems.length > 0 || hasOrderIntent");
    expect(webhook).toContain("orderItems.length > 0 && !hasIncompleteOrderEvidence");
  });

  it("blocks suggested-order draft creation until quantity and unit are explicit", () => {
    expect(suggested).toContain("item.quantity == null || item.quantity <= 0 || !item.unit");
    expect(suggested).toContain("items.length === 0");
    expect(suggested).not.toContain("quantity: i.quantity ?? 1");
  });
});
