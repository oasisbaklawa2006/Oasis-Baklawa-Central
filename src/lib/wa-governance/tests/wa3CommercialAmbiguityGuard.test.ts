import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webhook = fs.readFileSync(path.resolve(process.cwd(), "supabase/functions/whatsapp-webhook/index.ts"), "utf8");
const suggested = fs.readFileSync(path.resolve(process.cwd(), "src/components/warroom/SuggestedOrdersTab.tsx"), "utf8");

describe("WA-3 executable ambiguity guards", () => {
  it("keeps quantity interpretation out of the capture-only webhook", () => {
    expect(webhook).not.toContain("function parseQuantity");
    expect(webhook).not.toContain("aiParseOrder");
    expect(webhook).not.toContain("default to 1");
    expect(webhook).not.toMatch(/quantity\s*:\s*1\b/);
  });

  it("capture-only webhook cannot create or promote a direct order draft", () => {
    expect(webhook).not.toContain("orderItems");
    expect(webhook).not.toContain("hasIncompleteOrderEvidence");
    expect(webhook).not.toMatch(/\.from\(["']orders["']\)/);
    expect(webhook).not.toMatch(/\.from\(["']sales_order_drafts["']\)/);
    expect(webhook).not.toContain("admin-create-draft");
  });

  it("blocks suggested-order draft creation until quantity and unit are explicit", () => {
    expect(suggested).toContain("item.quantity == null || item.quantity <= 0 || !item.unit");
    expect(suggested).toContain("items.length === 0");
    expect(suggested).not.toContain("quantity: i.quantity ?? 1");
  });
});
