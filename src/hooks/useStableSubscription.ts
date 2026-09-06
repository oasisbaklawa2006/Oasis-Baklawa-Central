import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRealtimeEnabled } from "@/hooks/useRealtime";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import {
  MAX_READ_RETRY_ATTEMPTS,
  computeBoundedBackoffMs,
} from "@/lib/integration-contracts";

/**
 * Shared single-subscription hook per table.
 * Prevents memory leaks by deduplicating channels and cleaning up on unmount.
 */
export function useStableSubscription(
  tableName: string,
  queryKeys: string[][] = [],
  enabled = true,
  onChange?: () => void
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const queryKeysRef = useRef(queryKeys);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    queryKeysRef.current = queryKeys;
    onChangeRef.current = onChange;
  }, [queryKeys, onChange]);

  useEffect(() => {
    if (!enabled || !isRealtimeEnabled) return;

    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const baseChannelName = `stable-${tableName}`;

    const connect = () => {
      if (cancelled) return;
      removeDuplicateRealtimeChannel(baseChannelName);

      try {
        const channel = supabase
          .channel(baseChannelName)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: tableName },
            () => {
              queryKeysRef.current.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
              });
              onChangeRef.current?.();
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              retries = 0;
            } else if (
              (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
              !cancelled &&
              retries < MAX_READ_RETRY_ATTEMPTS
            ) {
              retries += 1;
              if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }
              retryTimer = setTimeout(connect, computeBoundedBackoffMs(retries));
            }
          });

        channelRef.current = channel;
      } catch (err) {
        console.warn(`[useStableSubscription:${tableName}] connect failed`, err);
        if (!cancelled && retries < MAX_READ_RETRY_ATTEMPTS) {
          retries += 1;
          retryTimer = setTimeout(connect, computeBoundedBackoffMs(retries));
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableName, enabled, queryClient]);
}
