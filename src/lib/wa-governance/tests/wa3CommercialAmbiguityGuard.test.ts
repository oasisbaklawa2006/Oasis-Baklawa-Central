import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webhook = fs.readFileSync(path.resolve(process.cwd(), "supabase/functions/whatsapp-webhook/index.ts"), "utf8");
const suggested = fs.readFileSync(path.resolve(process.cwd(), "src/components/warroom/SuggestedOrdersTab.tsx"), "utf8");

describe("WA-3 executable ambiguity guards", () => {
  it("never defaults an unknown WhatsApp quantity to one", () => {
    expect(webhook).not.toContain("default to 1");
    expect(webhook).not.toMatch(/quantity:\s*item\.quantity\s*\|\|\s*1/);
    expect(webhook).toContain("return null;");
  });

  it("does not create a direct draft solely from order intent without resolved lines", () => {
    expect(webhook).not.toContain("orderItems.length > 0 || hasOrderIntent");
  });

  it("blocks suggested-order draft creation until quantity and unit are explicit", () => {
    expect(suggested).toContain("item.quantity == null || item.quantity <= 0 || !item.unit");
    expect(suggested).not.toContain("quantity: i.quantity ?? 1");
  });
});
