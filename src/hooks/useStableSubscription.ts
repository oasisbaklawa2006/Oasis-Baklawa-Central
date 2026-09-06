import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isRealtimeEnabled } from "@/hooks/useRealtime";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";

/**
 * Shared single-subscription hook per table.
 * Point23: snapshot-first invalidation via scoped channel; cleans up on unmount.
 */
export function useStableSubscription(
  tableName: string,
  queryKeys: string[][] = [],
  enabled = true,
  onChange?: () => void,
) {
  const queryClient = useQueryClient();
  const queryKeysRef = useRef(queryKeys);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    queryKeysRef.current = queryKeys;
    onChangeRef.current = onChange;
  }, [queryKeys, onChange]);

  const snapshot = async () => {
    queryKeysRef.current.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
    onChangeRef.current?.();
  };

  useScopedRealtimeSubscription({
    domain: "postgres_table",
    scope: { type: "global_staff", tableName },
    changes: [{ event: "*", schema: "public", table: tableName }],
    enabled: enabled && isRealtimeEnabled,
    mode: "invalidate",
    snapshot,
    onDelta: snapshot,
    pollingFallbackMs: 30_000,
  });
}
