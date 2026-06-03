import type { ClientResolutionResult } from "./clientResolutionTypes";

export type ClientResolutionResultCache = Map<string, ClientResolutionResult>;

export type CachedClientResolutionReadyState = {
  status: "ready";
  result: ClientResolutionResult;
};

export function getCachedClientResolutionState(
  lookupKey: string,
  cache: ClientResolutionResultCache,
): CachedClientResolutionReadyState | null {
  const result = cache.get(lookupKey);
  if (!result) return null;
  return { status: "ready", result };
}

export function storeCachedClientResolutionResult(
  cache: ClientResolutionResultCache,
  lookupKey: string,
  result: ClientResolutionResult,
): void {
  cache.set(lookupKey, result);
}
