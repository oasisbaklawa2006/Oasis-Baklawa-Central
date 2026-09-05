import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AdminClients buyer approval gate", () => {
  it("keeps pricing slab mandatory before approval and documents the disabled Approve control", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminClients.tsx"), "utf8");
    expect(source).toContain("Pricing slab is required before approval");
    expect(source).toContain('disabled={actionLoading === selectedApp.id || !priceTier[selectedApp.id]}');
    expect(source).toContain('title={!priceTier[selectedApp.id] ? "Select a pricing slab to enable approval" : undefined}');
    expect(source).toContain("Approve & Activate");
  });
});
