import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webhook = fs.readFileSync(path.resolve(process.cwd(), "supabase/functions/whatsapp-webhook/index.ts"), "utf8");
const suggested = fs.readFileSync(path.resolve(process.cwd(), "src/components/warroom/SuggestedOrdersTab.tsx"), "utf8");

const raw = fs.readFileSync(path.resolve(process.cwd(), "src/components/warroom/RawIntelligenceTab.tsx"), "utf8");

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

  it.each([
    ["Suggested Orders", suggested],
    ["Raw Intelligence", raw],
  ])("routes %s draft work through Operator Inbox", (_screen, source) => {
    expect(source).toContain('to="/admin/operator-inbox"');
    expect(source).not.toMatch(/admin-create-draft|createSalesOrderDraft|create_sales_order_draft_atomic/);
    expect(source).not.toMatch(/quantity\s*:\s*[^,\n]*\?\?\s*1\b/);
  });
});
