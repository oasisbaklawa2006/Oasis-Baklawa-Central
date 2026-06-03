import { describe, expect, it } from "vitest";
import type { QuantityResolutionResult } from "@/lib/wa-governance/quantityResolutionTypes";
import {
  getCachedQuantityResolutionState,
  storeCachedQuantityResolutionResult,
} from "@/lib/wa-governance/quantityResolutionResultCache";

const sampleResult = (): QuantityResolutionResult => ({
  quantities: [
    {
      rawQuantity: 50,
      rawUnit: "boxes",
      productHint: null,
      confidence: 98,
      reasons: ["Detected explicit quantity 50 boxes in message"],
      band: "auto_highlight",
      conversionStatus: "unknown",
    },
  ],
  band: "auto_highlight",
});

describe("quantityResolutionResultCache", () => {
  it("returns ready state when requestKey is cached", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const requestKey = "packet-1:hash:client:none:product:none:identity:ready:customer::";
    storeCachedQuantityResolutionResult(cache, requestKey, sampleResult());

    expect(getCachedQuantityResolutionState(requestKey, cache)).toEqual({
      status: "ready",
      requestKey,
      result: sampleResult(),
    });
  });

  it("returns null when requestKey is not cached", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    expect(getCachedQuantityResolutionState("missing-key", cache)).toBeNull();
  });

  it("stores only successful payloads keyed by requestKey", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const firstKey = "packet-a:hash:client:none:product:none:identity:ready:customer::";
    const secondKey = "packet-b:hash:client:none:product:none:identity:ready:customer::";

    storeCachedQuantityResolutionResult(cache, firstKey, sampleResult());
    storeCachedQuantityResolutionResult(cache, secondKey, {
      ...sampleResult(),
      band: "suggested",
    });

    expect(cache.size).toBe(2);
    expect(getCachedQuantityResolutionState(firstKey, cache)?.result.band).toBe("auto_highlight");
    expect(getCachedQuantityResolutionState(secondKey, cache)?.result.band).toBe("suggested");
  });

  it("reuses cached payload without duplicate entries for the same key", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const requestKey = "packet-1:hash:client:none:product:none:identity:ready:customer::";
    const payload = sampleResult();

    storeCachedQuantityResolutionResult(cache, requestKey, payload);
    const firstHit = getCachedQuantityResolutionState(requestKey, cache);
    const secondHit = getCachedQuantityResolutionState(requestKey, cache);

    expect(firstHit?.result).toBe(payload);
    expect(secondHit?.result).toBe(payload);
    expect(cache.size).toBe(1);
  });
});
