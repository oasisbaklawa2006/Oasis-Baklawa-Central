import { describe, expect, it, vi } from "vitest";
import type { ApprovedAliasCatalog } from "../types";

const loadApprovedAliasCatalog = vi.fn();

vi.mock("../loadApprovedAliasCatalog", () => ({
  loadApprovedAliasCatalog: (...args: unknown[]) => loadApprovedAliasCatalog(...args),
}));

import { createProductIntelligenceService } from "../productIntelligenceService";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeCatalog(productCount: number): ApprovedAliasCatalog {
  return {
    products: [],
    aliases: [],
    loaded_at: `2026-06-10T00:00:0${productCount}.000Z`,
    product_count: productCount,
    alias_count: productCount,
    catalog_complete: true,
  };
}

describe("createProductIntelligenceService", () => {
  it("ignores stale loadCatalog results when a newer reload completes first", async () => {
    const first = deferred<ApprovedAliasCatalog>();
    const second = deferred<ApprovedAliasCatalog>();
    let call = 0;

    loadApprovedAliasCatalog.mockImplementation(() => {
      call += 1;
      return call === 1 ? first.promise : second.promise;
    });

    const service = createProductIntelligenceService(
      {} as import("@supabase/supabase-js").SupabaseClient,
    );

    const slow = service.loadCatalog();
    const fast = service.loadCatalog();

    second.resolve(makeCatalog(2));
    await expect(fast).resolves.toMatchObject({ product_count: 2 });
    expect(service.getCatalog()?.product_count).toBe(2);

    first.resolve(makeCatalog(1));
    await expect(slow).resolves.toMatchObject({ product_count: 2 });
    expect(service.getCatalog()?.product_count).toBe(2);
  });

  it("returns catalogue-not-loaded clarification when resolve runs without a catalogue", () => {
    const service = createProductIntelligenceService(
      {} as import("@supabase/supabase-js").SupabaseClient,
    );

    const result = service.resolve("Need 2 kg Kitta");

    expect(result.clarification_required).toBe(true);
    expect(result.best_match).toBeNull();
    expect(result.explanation).toMatch(/Catalogue not loaded/i);
    expect(result.candidate_products).toHaveLength(0);
  });
});
