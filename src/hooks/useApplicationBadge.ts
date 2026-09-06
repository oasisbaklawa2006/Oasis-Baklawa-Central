import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";
import {
  B2B_APPLICATIONS_INSERT_UPDATE_CHANGES,
  type RealtimeDeltaPayload,
} from "@/lib/realtime";

/**
 * Hook: Listens for new b2b_applications via Supabase Realtime.
 * Returns the count of pending applications and shows a toast for admin users.
 */
export function useApplicationBadge(isAdmin: boolean) {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("b2b_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (!error && count !== null) {
      setPendingCount(count);
    }
  }, []);

  const handleApplicationDelta = useCallback(
    (payload: RealtimeDeltaPayload) => {
      if (payload.changeEvent === "INSERT") {
        const newApp = payload.raw as { business_name?: string } | undefined;
        const name = newApp?.business_name || "Unknown";
        toast.info(`🆕 New B2B Application: ${name}`, {
          description: "A new client application requires your review.",
          duration: 8000,
        });
      }
    },
    [],
  );

  useScopedRealtimeSubscription({
    domain: "b2b_applications",
    scope: { type: "global_staff" },
    changes: B2B_APPLICATIONS_INSERT_UPDATE_CHANGES,
    enabled: isAdmin,
    mode: "refetch",
    snapshot: fetchCount,
    onAcceptedDelta: handleApplicationDelta,
    pollingFallbackMs: 30_000,
  });

  return pendingCount;
}
