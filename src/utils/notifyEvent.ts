import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized notification dispatcher.
 * Sends WhatsApp (Click2API send-text) + Email (Resend) for B2B events.
 * Multi-recipient: buyer, sales_exec, admin.
 */
export type NotifyAudience = "buyer" | "sales_exec" | "admin";

export interface NotifyEventParams {
  event: string;
  subject: string;
  message: string;
  audiences?: NotifyAudience[];
  orderId?: string | null;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
}

export const notifyEvent = async (params: NotifyEventParams) => {
  try {
    const { data, error } = await supabase.functions.invoke("notify-event", {
      body: params,
    });
    if (error) {
      console.error("[notifyEvent] failed:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (e: any) {
    console.error("[notifyEvent] exception:", e?.message);
    return { success: false, error: e?.message };
  }
};

// ── Convenience helpers for the 4 milestone events ──
export const notifyOrderPlaced = (orderId: string, orderRef: string, value?: number) =>
  notifyEvent({
    event: "order_placed",
    subject: `Order Placed — ${orderRef}`,
    message: `Your order ${orderRef} has been received and is awaiting confirmation.${
      value ? `\nOrder Value: ₹${value.toLocaleString("en-IN")}` : ""
    }\n\nTrack the 10-point artisan journey on your B2B portal.`,
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });

export const notifyOrderConfirmed = (orderId: string, orderRef: string) =>
  notifyEvent({
    event: "order_confirmed",
    subject: `Order Confirmed — ${orderRef}`,
    message: `Great news — your order ${orderRef} has been confirmed and queued for production.`,
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });

export const notifyOrderDispatched = (orderId: string, orderRef: string, tracking?: string) =>
  notifyEvent({
    event: "order_dispatched",
    subject: `Order Dispatched — ${orderRef}`,
    message: `Your order ${orderRef} has been dispatched from our facility.${
      tracking ? `\nTracking: ${tracking}` : "\nTracking details follow shortly."
    }`,
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });

export const notifyOrderDelivered = (orderId: string, orderRef: string) =>
  notifyEvent({
    event: "order_delivered",
    subject: `Order Delivered — ${orderRef}`,
    message: `Your order ${orderRef} has been delivered. Thank you for choosing Oasis Baklawa. We'd love your feedback!`,
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });
