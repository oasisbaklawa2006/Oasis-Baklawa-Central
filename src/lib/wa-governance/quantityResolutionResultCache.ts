import type { QuantityResolutionResult } from "./quantityResolutionTypes";

export type QuantityResolutionResultCache = Map<string, QuantityResolutionResult>;

export type CachedQuantityResolutionReadyState = {
  status: "ready";
  requestKey: string;
  result: QuantityResolutionResult;
};

export function getCachedQuantityResolutionState(
  cacheKey: string,
  logicalRequestKey: string,
  cache: QuantityResolutionResultCache,
): CachedQuantityResolutionReadyState | null {
  const result = cache.get(cacheKey);
  if (!result) return null;
  return { status: "ready", requestKey: logicalRequestKey, result };
}

export function storeCachedQuantityResolutionResult(
  cache: QuantityResolutionResultCache,
  requestKey: string,
  result: QuantityResolutionResult,
): void {
  cache.set(requestKey, result);
}
