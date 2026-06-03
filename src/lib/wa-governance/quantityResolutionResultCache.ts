import type { QuantityResolutionResult } from "./quantityResolutionTypes";

export type QuantityResolutionResultCache = Map<string, QuantityResolutionResult>;

export type CachedQuantityResolutionReadyState = {
  status: "ready";
  requestKey: string;
  result: QuantityResolutionResult;
};

export function getCachedQuantityResolutionState(
  requestKey: string,
  cache: QuantityResolutionResultCache,
): CachedQuantityResolutionReadyState | null {
  const result = cache.get(requestKey);
  if (!result) return null;
  return { status: "ready", requestKey, result };
}

export function storeCachedQuantityResolutionResult(
  cache: QuantityResolutionResultCache,
  requestKey: string,
  result: QuantityResolutionResult,
): void {
  cache.set(requestKey, result);
}
