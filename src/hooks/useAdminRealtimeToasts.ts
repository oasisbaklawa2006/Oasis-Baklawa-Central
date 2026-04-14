import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { toast } from "sonner";

/**
 * Persistent Supabase Realtime listener for admin panel.
 * Shows bottom-right toast on new orders or b2b_applications INSERTs.
 */
export function useAdminRealtimeToasts(enabled: boolean) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = "admin-global-toasts";
    removeDuplicateRealtimeChannel(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as any;
          if (order.status === "draft" || order.status === "cart") return;
          toast.info("📦 New Order Received", {
            description: `Order ${order.id?.split("-")[0]?.toUpperCase() || "—"} has been submitted.`,
            duration: 6000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "b2b_applications" },
        (payload) => {
          const app = payload.new as any;
          toast.info("🆕 New B2B Application", {
            description: `${app.business_name || "Unknown"} has applied for trade access.`,
            duration: 8000,
          });
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
  }, [enabled]);
}
