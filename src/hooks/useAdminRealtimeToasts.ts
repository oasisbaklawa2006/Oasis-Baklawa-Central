import { useCallback } from "react";
import { toast } from "sonner";
import { useScopedRealtimeSubscription } from "@/hooks/useScopedRealtimeSubscription";
import {
  B2B_APPLICATIONS_INSERT_CHANGES,
  ORDERS_INSERT_CHANGES,
  type RealtimeDeltaPayload,
} from "@/lib/realtime";

/**
 * Persistent Supabase Realtime listener for admin panel.
 * Shows bottom-right toast on new orders or b2b_applications INSERTs.
 */
export function useAdminRealtimeToasts(enabled: boolean) {
  const handleOrderDelta = useCallback((payload: RealtimeDeltaPayload) => {
    if (payload.changeEvent !== "INSERT") return;
    const order = payload.raw as { id?: string; status?: string } | undefined;
    if (!order || order.status === "draft" || order.status === "cart") return;
    toast.info("📦 New Order Received", {
      description: `Order ${order.id?.split("-")[0]?.toUpperCase() || "—"} has been submitted.`,
      duration: 6000,
    });
  }, []);

  const handleApplicationDelta = useCallback((payload: RealtimeDeltaPayload) => {
    if (payload.changeEvent !== "INSERT") return;
    const app = payload.raw as { business_name?: string } | undefined;
    toast.info("🆕 New B2B Application", {
      description: `${app?.business_name || "Unknown"} has applied for trade access.`,
      duration: 8000,
    });
  }, []);

  useScopedRealtimeSubscription({
    domain: "orders",
    scope: { type: "global_staff" },
    changes: ORDERS_INSERT_CHANGES,
    enabled,
    mode: "invalidate",
    snapshot: async () => {},
    onAcceptedDelta: handleOrderDelta,
  });

  useScopedRealtimeSubscription({
    domain: "b2b_applications",
    scope: { type: "global_staff" },
    changes: B2B_APPLICATIONS_INSERT_CHANGES,
    enabled,
    mode: "invalidate",
    snapshot: async () => {},
    onAcceptedDelta: handleApplicationDelta,
  });
}
