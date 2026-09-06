import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isRealtimeEnabled } from "@/hooks/useRealtime";
import {
  assertAuthorizedRealtimeChannel,
  createRealtimeSubscriptionController,
  normalizeRealtimeChannelName,
  toRealtimeDeltaPayload,
  type PostgresChangeSpec,
  type RealtimeDeltaMode,
  type RealtimeDomain,
  type RealtimeScope,
  type RealtimeTransportStatus,
} from "@/lib/realtime";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";

export type ScopedRealtimeSubscriptionOptions = {
  domain: RealtimeDomain;
  scope: RealtimeScope;
  changes: PostgresChangeSpec[];
  enabled?: boolean;
  mode?: RealtimeDeltaMode;
  snapshot: () => Promise<void>;
  onDelta?: () => void;
  onStatusChange?: (status: RealtimeTransportStatus) => void;
  pollingFallbackMs?: number;
};

/**
 * Point23 canonical Central subscription: snapshot first, scoped delta second.
 * Realtime is never business truth — default mode refetches via snapshot on accepted deltas.
 */
export function useScopedRealtimeSubscription(options: ScopedRealtimeSubscriptionOptions) {
  const {
    domain,
    scope,
    changes,
    enabled = true,
    mode = "refetch",
    snapshot,
    onDelta,
    onStatusChange,
    pollingFallbackMs,
  } = options;

  const snapshotRef = useRef(snapshot);
  const onDeltaRef = useRef(onDelta);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    snapshotRef.current = snapshot;
    onDeltaRef.current = onDelta;
    onStatusChangeRef.current = onStatusChange;
  }, [snapshot, onDelta, onStatusChange]);

  useEffect(() => {
    if (!enabled || !isRealtimeEnabled) return;

    const auth = assertAuthorizedRealtimeChannel(domain, scope);
    if (auth.allowed !== true) {
      console.warn("[useScopedRealtimeSubscription] unauthorized channel:", auth.reason);
      return;
    }

    const channelName = normalizeRealtimeChannelName(auth.channelName);
    removeDuplicateRealtimeChannel(channelName);

    const controller = createRealtimeSubscriptionController({
      domain,
      scope,
      changes,
      mode,
      snapshot: () => snapshotRef.current(),
      onDelta: () => {
        if (mode === "refetch") {
          void snapshotRef.current();
        }
        onDeltaRef.current?.();
      },
      onStatusChange: (status) => onStatusChangeRef.current?.(status),
      pollingFallbackMs,
      channelAdapter: {
        subscribe: (name, onStatus, onChange) => {
          let channel = supabase.channel(name);
          for (const spec of changes) {
            channel = channel.on(
              "postgres_changes",
              {
                event: spec.event,
                schema: spec.schema,
                table: spec.table,
                ...(spec.filter ? { filter: spec.filter } : {}),
              },
              (payload) => {
                const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
                onChange(toRealtimeDeltaPayload(spec.table, row));
              },
            );
          }

          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") onStatus("SUBSCRIBED");
            else if (status === "CHANNEL_ERROR") onStatus("CHANNEL_ERROR");
            else if (status === "TIMED_OUT") onStatus("TIMED_OUT");
            else if (status === "CLOSED") onStatus("CLOSED");
          });

          return {
            unsubscribe: () => {
              void supabase.removeChannel(channel);
            },
          };
        },
      },
    });

    void controller.start();

    return () => {
      controller.stop();
    };
  }, [domain, scope, changes, enabled, mode, pollingFallbackMs]);
}
