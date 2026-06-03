import { describe, expect, it } from "vitest";
import { findWarmCachedQuantityResolutionState } from "@/components/whatsapp/useOperatorInboxQuantityResolution";
import { buildQuantityResolutionResultCacheKey } from "@/lib/wa-governance/quantityResolutionCacheKey";
import {
  projectQuantityResolutionDisplayState,
  quantityResolutionStateMatchesRequestKey,
} from "@/lib/wa-governance/quantityResolutionRequestKey";
import {
  getCachedQuantityResolutionState,
  storeCachedQuantityResolutionResult,
} from "@/lib/wa-governance/quantityResolutionResultCache";
import type { QuantityResolutionResult } from "@/lib/wa-governance/quantityResolutionTypes";

const logicalRequestKey = "packet-1:fp:client:c-1:Acme:product:p-1:Baklava:identity:ready:customer:Acme:Alice";

const sampleResult = (label: string): QuantityResolutionResult => ({
  quantities: [
    {
      rawQuantity: 2,
      rawUnit: "cartons",
      productHint: "Baklava",
      confidence: 98,
      reasons: [label],
      band: "auto_highlight",
      conversionStatus: "resolved",
      normalizedQuantity: 48,
      normalizedUnit: "pcs",
      conversionSource: "products.pcs_per_master_carton",
    },
  ],
  band: "auto_highlight",
});

const catalogueProfile24 = {
  category: "Baklava",
  uom: "Pc",
  pcs_per_master_carton: 24,
};

const catalogueProfile12 = {
  category: "Baklava",
  uom: "Pc",
  pcs_per_master_carton: 12,
};

type HookPhase =
  | { kind: "loading"; requestKey: string }
  | { kind: "ready"; requestKey: string; cacheKey: string; result: QuantityResolutionResult }
  | { kind: "stale-ready"; requestKey: string; result: QuantityResolutionResult };

function simulateHookCacheHit(
  cache: Map<string, QuantityResolutionResult>,
  logicalKey: string,
  catalogueProduct: typeof catalogueProfile24 | null,
): HookPhase {
  const cacheKey = buildQuantityResolutionResultCacheKey(logicalKey, catalogueProduct);
  const cached = getCachedQuantityResolutionState(cacheKey, logicalKey, cache);
  if (!cached) {
    return { kind: "loading", requestKey: logicalKey };
  }
  const projected = projectQuantityResolutionDisplayState(cached, logicalKey);
  if (projected.status === "loading") {
    return { kind: "loading", requestKey: logicalKey };
  }
  if (projected.status === "ready") {
    return { kind: "ready", requestKey: logicalKey, cacheKey, result: projected.result };
  }
  throw new Error(`Unexpected projected state: ${projected.status}`);
}

function shouldApplyAsyncResult(
  activeRequestKey: string | null,
  requestKeyAtStart: string,
  cancelled: boolean,
): boolean {
  if (cancelled) return false;
  return activeRequestKey === requestKeyAtStart;
}

describe("quantityResolution cache/request lifecycle", () => {
  it("renders warm cache synchronously without an intermediate loading state", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const cacheKey = buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile24);
    storeCachedQuantityResolutionResult(cache, cacheKey, sampleResult("warm hit"));

    const warm = findWarmCachedQuantityResolutionState(logicalRequestKey, cache);
    expect(warm).toEqual({
      status: "ready",
      requestKey: logicalRequestKey,
      result: sampleResult("warm hit"),
    });

    const projected = projectQuantityResolutionDisplayState(warm!, logicalRequestKey);
    expect(projected.status).toBe("ready");
    expect(projected).not.toEqual({ status: "loading", requestKey: logicalRequestKey });
  });

  it("returns null for warm lookup on cache miss so async loading can proceed", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    expect(findWarmCachedQuantityResolutionState(logicalRequestKey, cache)).toBeNull();
  });

  it("returns null for warm lookup when multiple catalogue fingerprints exist", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    storeCachedQuantityResolutionResult(
      cache,
      buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile24),
      sampleResult("24 pc carton"),
    );
    storeCachedQuantityResolutionResult(
      cache,
      buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile12),
      sampleResult("12 pc carton"),
    );

    expect(findWarmCachedQuantityResolutionState(logicalRequestKey, cache)).toBeNull();
  });

  it("accepts cached result on revisit without breaking request key identity", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const cacheKey = buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile24);
    const payload = sampleResult("first resolve");

    storeCachedQuantityResolutionResult(cache, cacheKey, payload);

    const revisit = simulateHookCacheHit(cache, logicalRequestKey, catalogueProfile24);
    expect(revisit).toMatchObject({
      kind: "ready",
      requestKey: logicalRequestKey,
    });
    expect(quantityResolutionStateMatchesRequestKey(
      { status: "ready", requestKey: logicalRequestKey, result: payload },
      logicalRequestKey,
    )).toBe(true);
  });

  it("does not leave catalogue-aware cache hits stuck in loading display state", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const cacheKey = buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile24);
    storeCachedQuantityResolutionResult(cache, cacheKey, sampleResult("catalogue hit"));

    const cached = getCachedQuantityResolutionState(cacheKey, logicalRequestKey, cache);
    expect(cached?.requestKey).toBe(logicalRequestKey);
    expect(cached?.requestKey).not.toBe(cacheKey);

    const projected = projectQuantityResolutionDisplayState(cached!, logicalRequestKey);
    expect(projected.status).toBe("ready");
    expect(projected).not.toEqual({ status: "loading", requestKey: logicalRequestKey });
  });

  it("creates separate cache entries when catalogue fingerprint changes", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const cacheKey24 = buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile24);
    const cacheKey12 = buildQuantityResolutionResultCacheKey(logicalRequestKey, catalogueProfile12);

    expect(cacheKey24).not.toBe(cacheKey12);

    storeCachedQuantityResolutionResult(cache, cacheKey24, sampleResult("24 pc carton"));
    storeCachedQuantityResolutionResult(cache, cacheKey12, sampleResult("12 pc carton"));

    expect(cache.size).toBe(2);
    expect(getCachedQuantityResolutionState(cacheKey24, logicalRequestKey, cache)?.result.quantities[0]?.reasons[0]).toBe(
      "24 pc carton",
    );
    expect(getCachedQuantityResolutionState(cacheKey12, logicalRequestKey, cache)?.result.quantities[0]?.reasons[0]).toBe(
      "12 pc carton",
    );
  });

  it("blocks stale async responses from overwriting a newer request", () => {
    const requestA = "packet-a:key";
    const requestB = "packet-b:key";

    expect(shouldApplyAsyncResult(requestB, requestA, false)).toBe(false);
    expect(shouldApplyAsyncResult(requestB, requestB, false)).toBe(true);
    expect(shouldApplyAsyncResult(requestB, requestB, true)).toBe(false);
  });

  it("handles request A -> request B -> cached request A without cross-contamination", () => {
    const cache = new Map<string, QuantityResolutionResult>();
    const keyA = "packet-a:shared";
    const keyB = "packet-b:shared";
    const cacheKeyA = buildQuantityResolutionResultCacheKey(keyA, catalogueProfile24);
    const cacheKeyB = buildQuantityResolutionResultCacheKey(keyB, catalogueProfile24);

    storeCachedQuantityResolutionResult(cache, cacheKeyA, sampleResult("result A"));
    storeCachedQuantityResolutionResult(cache, cacheKeyB, sampleResult("result B"));

    const phaseB = simulateHookCacheHit(cache, keyB, catalogueProfile24);
    expect(phaseB).toMatchObject({ kind: "ready", requestKey: keyB });
    expect(phaseB.kind === "ready" ? phaseB.result.quantities[0]?.reasons[0] : null).toBe("result B");

    const phaseA = simulateHookCacheHit(cache, keyA, catalogueProfile24);
    expect(phaseA).toMatchObject({ kind: "ready", requestKey: keyA });
    expect(phaseA.kind === "ready" ? phaseA.result.quantities[0]?.reasons[0] : null).toBe("result A");

    expect(projectQuantityResolutionDisplayState(
      { status: "ready", requestKey: keyA, result: sampleResult("result A") },
      keyB,
    )).toEqual({ status: "loading", requestKey: keyB });
  });
});
