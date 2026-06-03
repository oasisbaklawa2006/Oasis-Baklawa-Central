import type { ProductResolutionResult } from "./productResolutionTypes";

export type ProductResolutionResultCache = Map<string, ProductResolutionResult>;

export type CachedProductResolutionReadyState = {
  status: "ready";
  requestKey: string;
  result: ProductResolutionResult;
};

export function getCachedProductResolutionState(
  requestKey: string,
  cache: ProductResolutionResultCache,
): CachedProductResolutionReadyState | null {
  const result = cache.get(requestKey);
  if (!result) return null;
  return { status: "ready", requestKey, result };
}

export function storeCachedProductResolutionResult(
  cache: ProductResolutionResultCache,
  requestKey: string,
  result: ProductResolutionResult,
): void {
  cache.set(requestKey, result);
}
