import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Point 55 publication projection surface guard", () => {
  it("catalogue sync status consumes published_products_v1 instead of inferring publication from products", () => {
    const page = source("src/pages/admin/AdminCatalogueSyncStatus.tsx");

    expect(page).toContain("fetchPublishedOperationalProducts");
    expect(page).toContain("isProductPublishedOperational");
    expect(page).toContain("OperationalReadOnlyBanner");
    expect(page).not.toMatch(/\.from\(["']products["']\)[\s\S]*visible_in_catalog/);
    expect(page).not.toMatch(/\.from\(["']products["']\)[\s\S]*is_catalogue_ready/);
  });

  it("published-products client binds to the Core RPC contract", () => {
    const client = source("src/lib/published-products/publishedProductsClient.ts");
    expect(client).toContain('supabase.rpc("published_products_v1")');
    expect(client).not.toContain('.from("products")');
  });
});
