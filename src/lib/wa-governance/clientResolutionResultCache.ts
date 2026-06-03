import type { ClientResolutionResult } from "./clientResolutionTypes";

export type ClientResolutionResultCache = Map<string, ClientResolutionResult>;

export type CachedClientResolutionReadyState = {
  status: "ready";
  requestKey: string;
  result: ClientResolutionResult;
};

export function getCachedClientResolutionState(
  requestKey: string,
  cache: ClientResolutionResultCache,
): CachedClientResolutionReadyState | null {
  const result = cache.get(requestKey);
  if (!result) return null;
  return { status: "ready", requestKey, result };
}

export function storeCachedClientResolutionResult(
  cache: ClientResolutionResultCache,
  requestKey: string,
  result: ClientResolutionResult,
): void {
  cache.set(requestKey, result);
}
