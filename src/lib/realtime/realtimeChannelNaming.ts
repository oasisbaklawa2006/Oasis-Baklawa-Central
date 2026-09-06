import type { RealtimeDomain, RealtimeScope } from "./types";
import { validateRealtimeScope } from "./realtimeScopeGuard";

const CHANNEL_PREFIX = "central";

/** Strip accidental `realtime:` prefixes so dedup and topic matching stay deterministic. */
export function normalizeRealtimeChannelName(channelName: string): string {
  return channelName.replace(/^(?:realtime:)+/, "");
}

export function buildCentralRealtimeChannelName(
  domain: RealtimeDomain,
  scope: RealtimeScope,
): string {
  const scopeResult = validateRealtimeScope(scope);
  if (scopeResult.allowed !== true) {
    throw new Error(scopeResult.reason);
  }

  return `${CHANNEL_PREFIX}:${domain}:${scope.type}:${scopeResult.channelName}`;
}

export function supabaseTopicForChannel(channelName: string): string {
  return `realtime:${normalizeRealtimeChannelName(channelName)}`;
}
