import { supabase } from "@/integrations/supabase/client";
import { validateNotifyEventParams } from "@/lib/notification-infrastructure/notifyEventValidation";

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
  const validation = validateNotifyEventParams(params);
  if (validation.ok === false) {
    console.error("[notifyEvent] validation failed:", validation.reason);
    return { success: false, error: validation.reason };
  }

  try {
    const { data, error } = await supabase.functions.invoke("notify-event", {
      body: params,
    });
    if (error) {
      console.error("[notifyEvent] failed:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "notify_event_exception";
    console.error("[notifyEvent] exception:", message);
    return { success: false, error: message };
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

export const notifyOrderDispatched = (
  orderId: string,
  orderRef: string,
  opts?: { tracking?: string; transporter?: string; lr?: string },
) => {
  const lines: string[] = [`Your order ${orderRef} has been dispatched from our facility.`];
  if (opts?.transporter?.trim()) lines.push(`Transporter: ${opts.transporter.trim()}`);
  if (opts?.lr?.trim()) lines.push(`LR / AWB / Bilty: ${opts.lr.trim()}`);
  else if (opts?.tracking?.trim()) lines.push(`Tracking: ${opts.tracking.trim()}`);
  else lines.push("See your portal for consignment details.");
  return notifyEvent({
    event: "order_dispatched",
    subject: `Order Dispatched — ${orderRef}`,
    message: lines.join("\n"),
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });
};

export const notifyOrderDelivered = (orderId: string, orderRef: string) =>
  notifyEvent({
    event: "order_delivered",
    subject: `Order Delivered — ${orderRef}`,
    message: `Your order ${orderRef} has been delivered. Thank you for choosing Oasis Baklawa. We'd love your feedback!`,
    audiences: ["buyer", "sales_exec", "admin"],
    orderId,
  });
