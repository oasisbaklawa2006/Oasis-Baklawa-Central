import {
  createRealtimeDedupeState,
  evaluateRealtimeDelta,
  recordAcceptedRealtimeDelta,
  type RealtimeDedupeState,
} from "./realtimeDedupe";
import { assertAuthorizedRealtimeChannel } from "./realtimeScopeGuard";
import {
  canApplyRealtimeDelta,
  nextStatusAfterChannelFailure,
  nextStatusAfterSnapshot,
  nextStatusAfterSubscribeSuccess,
  shouldRunPollingFallback,
} from "./realtimeTransportState";
import type {
  RealtimeDeltaPayload,
  RealtimeSubscriptionConfig,
  RealtimeTransportStatus,
} from "./types";

export type RealtimeChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

export type RealtimeChannelAdapter = {
  subscribe: (
    channelName: string,
    onStatus: (status: RealtimeChannelStatus) => void,
    onChange: (payload: RealtimeDeltaPayload) => void,
  ) => { unsubscribe: () => void };
};

export type RealtimeSubscriptionController = {
  start: () => Promise<void>;
  stop: () => void;
  getStatus: () => RealtimeTransportStatus;
  getChannelName: () => string | null;
  handleDelta: (payload: RealtimeDeltaPayload) => void;
  reconcile: () => Promise<void>;
  isPollingFallbackActive: () => boolean;
};

type ControllerOptions = RealtimeSubscriptionConfig & {
  channelAdapter: RealtimeChannelAdapter;
  now?: () => number;
};

export function createRealtimeSubscriptionController(
  options: ControllerOptions,
): RealtimeSubscriptionController {
  const {
    domain,
    scope,
    snapshot,
    onDelta,
    onStatusChange,
    channelAdapter,
    maxReconnectAttempts = 5,
    reconnectBackoffMs = 10_000,
    pollingFallbackMs = 30_000,
    now = () => Date.now(),
  } = options;

  const auth = assertAuthorizedRealtimeChannel(domain, scope);
  if (auth.allowed !== true) {
    throw new Error(auth.reason);
  }

  const channelName = auth.channelName;
  let status: RealtimeTransportStatus = "idle";
  let dedupe: RealtimeDedupeState = createRealtimeDedupeState();
  let channelUnsubscribe: (() => void) | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let snapshotCompleted = false;
  let generation = 0;

  const setStatus = (next: RealtimeTransportStatus) => {
    if (status === next) return;
    status = next;
    onStatusChange?.(next);
    syncPollingFallback();
  };

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const syncPollingFallback = () => {
    const shouldPoll = shouldRunPollingFallback(status, pollingFallbackMs);
    if (shouldPoll && !pollingTimer) {
      pollingTimer = setInterval(() => {
        void snapshot().catch(() => {
          /* snapshot errors surface via caller; polling keeps trying */
        });
      }, pollingFallbackMs);
    } else if (!shouldPoll && pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const runSnapshot = async (): Promise<boolean> => {
    setStatus("snapshot_loading");
    snapshotCompleted = false;
    try {
      await snapshot();
    } catch {
      setStatus("degraded");
      return false;
    }
    snapshotCompleted = true;
    setStatus(nextStatusAfterSnapshot(status));
    return true;
  };

  const connectChannel = () => {
    if (stopped) return;
    setStatus("connecting");
    if (stopped) return;

    channelUnsubscribe?.();
    channelUnsubscribe = null;

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      subscription = channelAdapter.subscribe(
        channelName,
        (channelStatus) => {
          if (stopped) return;

          if (channelStatus === "SUBSCRIBED") {
            reconnectAttempts = 0;
            setStatus(nextStatusAfterSubscribeSuccess());
            return;
          }

          if (
            channelStatus === "CHANNEL_ERROR" ||
            channelStatus === "TIMED_OUT" ||
            channelStatus === "CLOSED"
          ) {
            reconnectAttempts += 1;
            channelUnsubscribe?.();
            channelUnsubscribe = null;
            setStatus(nextStatusAfterChannelFailure(reconnectAttempts, maxReconnectAttempts));

            if (!stopped && reconnectAttempts < maxReconnectAttempts) {
              reconnectTimer = setTimeout(() => {
                void reconcile();
              }, reconnectBackoffMs);
            }
          }
        },
        (payload) => {
          handleDelta(payload);
        },
      );
    } catch (error) {
      subscription?.unsubscribe();
      throw error;
    }

    if (stopped || status === "degraded" || status === "unavailable") {
      subscription.unsubscribe();
      return;
    }
    channelUnsubscribe = subscription.unsubscribe;
  };

  const reconcile = async () => {
    if (stopped) return;
    const currentGen = ++generation;
    dedupe = createRealtimeDedupeState();
    const snapshotOk = await runSnapshot();
    if (stopped || currentGen !== generation) return;
    if (snapshotOk) {
      connectChannel();
    }
  };

  const handleDelta = (payload: RealtimeDeltaPayload) => {
    if (!snapshotCompleted) {
      return;
    }
    if (!canApplyRealtimeDelta(status)) {
      return;
    }

    const decision = evaluateRealtimeDelta(dedupe, payload);
    if (!decision.accept) {
      return;
    }

    recordAcceptedRealtimeDelta(dedupe, payload);
    onDelta?.(payload);
  };

  const start = async () => {
    if (stopped) {
      stopped = false;
    }
    await reconcile();
  };

  const stop = () => {
    stopped = true;
    generation += 1;
    clearTimers();
    channelUnsubscribe?.();
    channelUnsubscribe = null;
    snapshotCompleted = false;
    reconnectAttempts = 0;
    dedupe = createRealtimeDedupeState();
    setStatus("idle");
  };

  return {
    start,
    stop,
    getStatus: () => status,
    getChannelName: () => channelName,
    handleDelta,
    reconcile,
    isPollingFallbackActive: () => pollingTimer != null,
  };
}

/** Map postgres payload to versioned delta — realtime is never authoritative business truth. */
export function toRealtimeDeltaPayload(
  table: string,
  raw: Record<string, unknown>,
  now: () => number = () => Date.now(),
): RealtimeDeltaPayload {
  const entityId =
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw.order_id === "string" && raw.order_id) ||
    undefined;

  const updatedAt =
    (typeof raw.updated_at === "string" && Date.parse(raw.updated_at)) ||
    (typeof raw.created_at === "string" && Date.parse(raw.created_at)) ||
    now();

  return {
    eventId: `${table}:${entityId ?? "row"}:${updatedAt}:${JSON.stringify(raw)}`,
    version: Number.isFinite(updatedAt) ? updatedAt : now(),
    table,
    entityId,
    occurredAt: new Date(updatedAt).toISOString(),
    raw,
  };
}
