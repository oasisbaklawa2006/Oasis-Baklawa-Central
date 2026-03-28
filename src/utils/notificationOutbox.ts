import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════
// NOTIFICATION GATEWAY — LIVE CONFIGURATION
// ═══════════════════════════════════════════════════════════

const RESEND_CONFIG = {
  apiKey: "re_QN2tDgHK_PwuSsAiqENCdjCFS2xn2FUcu",
  fromEmail: "onboarding@resend.dev",
};

/**
 * Queue a notification message into the outbox for later processing.
 */
export const queueNotification = async (params: {
  eventType: string;
  messageBody: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  priority?: string;
}) => {
  const { error } = await supabase.from("notification_outbox").insert({
    event_type: params.eventType,
    message_body: params.messageBody,
    recipient_phone: params.recipientPhone || null,
    recipient_email: params.recipientEmail || null,
    priority: params.priority || "normal",
    status: "pending",
  } as any);

  if (error) {
    console.error("[Outbox] Failed to queue notification:", error.message);
  }
};

/**
 * Process pending messages in the outbox — LIVE MODE.
 * Sends emails via Resend API, then updates status accordingly.
 */
export const processOutboxQueue = async (): Promise<number> => {
  const { data: pending } = await supabase
    .from("notification_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!pending || pending.length === 0) return 0;

  let processed = 0;

  for (const msg of pending) {
    try {
      // 📧 LIVE EMAIL DELIVERY via Resend
      if (msg.recipient_email) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_CONFIG.apiKey}`,
          },
          body: JSON.stringify({
            from: RESEND_CONFIG.fromEmail,
            to: msg.recipient_email,
            subject: `Oasis Notification: ${msg.event_type}`,
            text: msg.message_body,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Resend API Error");
        }
      }

      // Mark as sent
      await supabase
        .from("notification_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() } as any)
        .eq("id", msg.id);

      processed++;
    } catch (err: any) {
      // Mark as failed with error log
      await supabase
        .from("notification_outbox")
        .update({ status: "failed", error_log: err?.message || "Unknown error" } as any)
        .eq("id", msg.id);
    }
  }

  return processed;
};
