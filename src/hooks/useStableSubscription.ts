import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";

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
    if (!enabled) return;

    const channelName = `stable-${tableName}`;
    removeDuplicateRealtimeChannel(channelName);

    const channel = supabase
      .channel(channelName)
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
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableName, enabled, queryClient]);
}
