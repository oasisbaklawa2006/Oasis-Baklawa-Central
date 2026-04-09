import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { toast } from "sonner";

/**
 * Hook: Listens for new b2b_applications via Supabase Realtime.
 * Returns the count of pending applications and shows a toast for admin users.
 */
export function useApplicationBadge(isAdmin: boolean) {
  const [pendingCount, setPendingCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("b2b_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (!error && count !== null) {
      setPendingCount(count);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    fetchCount();

    const channelName = "admin-b2b-applications";
    removeDuplicateRealtimeChannel(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "b2b_applications" },
        (payload) => {
          const newApp = payload.new as any;
          const name = newApp?.business_name || "Unknown";
          toast.info(`🆕 New B2B Application: ${name}`, {
            description: "A new client application requires your review.",
            duration: 8000,
          });
          setPendingCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "b2b_applications" },
        () => {
          fetchCount();
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
  }, [isAdmin, fetchCount]);

  return pendingCount;
}
