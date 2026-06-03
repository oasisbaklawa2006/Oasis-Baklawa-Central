import { describe, expect, it } from "vitest";
import type { ProductResolutionResult } from "@/lib/wa-governance/productResolutionTypes";
import {
  getCachedProductResolutionState,
  storeCachedProductResolutionResult,
} from "@/lib/wa-governance/productResolutionResultCache";

const sampleResult = (): ProductResolutionResult => ({
  candidateProducts: [
    {
      productId: "p-1",
      productName: "Assorted Baklawa 400gm Tin",
      sku: "BK-400",
      confidence: 96,
      reasons: ['Exact product name "Assorted Baklawa 400gm Tin" matches catalog'],
    },
  ],
  bestMatch: {
    productId: "p-1",
    productName: "Assorted Baklawa 400gm Tin",
    sku: "BK-400",
    confidence: 96,
    reasons: ['Exact product name "Assorted Baklawa 400gm Tin" matches catalog'],
  },
  band: "auto_highlight",
});

describe("productResolutionResultCache", () => {
  it("returns ready state when requestKey is cached", () => {
    const cache = new Map<string, ProductResolutionResult>();
    const requestKey = "packet-1:hash:client:none:identity:ready:customer::";
    storeCachedProductResolutionResult(cache, requestKey, sampleResult());

    expect(getCachedProductResolutionState(requestKey, cache)).toEqual({
      status: "ready",
      requestKey,
      result: sampleResult(),
    });
  });

  it("returns null when requestKey is not cached", () => {
    const cache = new Map<string, ProductResolutionResult>();
    expect(getCachedProductResolutionState("missing-key", cache)).toBeNull();
  });

  it("stores only successful payloads keyed by requestKey", () => {
    const cache = new Map<string, ProductResolutionResult>();
    const firstKey = "packet-a:hash:client:none:identity:ready:customer::";
    const secondKey = "packet-b:hash:client:none:identity:ready:customer::";

    storeCachedProductResolutionResult(cache, firstKey, sampleResult());
    storeCachedProductResolutionResult(cache, secondKey, {
      ...sampleResult(),
      band: "suggested",
    });

    expect(cache.size).toBe(2);
    expect(getCachedProductResolutionState(firstKey, cache)?.result.band).toBe("auto_highlight");
    expect(getCachedProductResolutionState(secondKey, cache)?.result.band).toBe("suggested");
  });

  it("reuses cached payload without duplicate entries for the same key", () => {
    const cache = new Map<string, ProductResolutionResult>();
    const requestKey = "packet-1:hash:client:none:identity:ready:customer::";
    const payload = sampleResult();

    storeCachedProductResolutionResult(cache, requestKey, payload);
    const firstHit = getCachedProductResolutionState(requestKey, cache);
    const secondHit = getCachedProductResolutionState(requestKey, cache);

    expect(firstHit?.result).toBe(payload);
    expect(secondHit?.result).toBe(payload);
    expect(cache.size).toBe(1);
  });
});
