import type { RealtimeDeltaPayload } from "./types";

const MAX_SEEN_EVENT_IDS = 1_000;
const MAX_ENTITY_VERSIONS = 1_000;

export type RealtimeDedupeState = {
  seenEventIds: Set<string>;
  lastVersionByEntity: Map<string, number>;
};

export function createRealtimeDedupeState(): RealtimeDedupeState {
  return {
    seenEventIds: new Set<string>(),
    lastVersionByEntity: new Map<string, number>(),
  };
}

export type RealtimeDedupeDecision =
  | { accept: true; reason: "first_seen" | "newer_version" }
  | { accept: false; reason: "duplicate_event" | "stale_version" | "missing_identity" };

function entityKey(payload: RealtimeDeltaPayload): string | null {
  if (!payload.entityId) return null;
  return `${payload.table}:${payload.entityId}`;
}

function evictOldestSetEntry(values: Set<string>, limit: number): void {
  while (values.size > limit) {
    const oldest = values.values().next().value;
    if (typeof oldest !== "string") break;
    values.delete(oldest);
  }
}

function evictOldestMapEntry(values: Map<string, number>, limit: number): void {
  while (values.size > limit) {
    const oldest = values.keys().next().value;
    if (typeof oldest !== "string") break;
    values.delete(oldest);
  }
}

export function evaluateRealtimeDelta(
  state: RealtimeDedupeState,
  payload: RealtimeDeltaPayload,
): RealtimeDedupeDecision {
  if (!payload.eventId?.trim()) {
    return { accept: false, reason: "missing_identity" };
  }

  if (state.seenEventIds.has(payload.eventId)) {
    return { accept: false, reason: "duplicate_event" };
  }

  const key = entityKey(payload);
  if (key) {
    const lastVersion = state.lastVersionByEntity.get(key);
    if (typeof lastVersion === "number" && payload.version <= lastVersion) {
      return { accept: false, reason: "stale_version" };
    }
  }

  return { accept: true, reason: key ? "newer_version" : "first_seen" };
}

export function recordAcceptedRealtimeDelta(
  state: RealtimeDedupeState,
  payload: RealtimeDeltaPayload,
): void {
  state.seenEventIds.add(payload.eventId);
  evictOldestSetEntry(state.seenEventIds, MAX_SEEN_EVENT_IDS);

  const key = entityKey(payload);
  if (key) {
    const prev = state.lastVersionByEntity.get(key) ?? 0;
    state.lastVersionByEntity.delete(key);
    state.lastVersionByEntity.set(key, Math.max(prev, payload.version));
    evictOldestMapEntry(state.lastVersionByEntity, MAX_ENTITY_VERSIONS);
  }
}
