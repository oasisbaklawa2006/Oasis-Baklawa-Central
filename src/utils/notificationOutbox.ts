import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════
// NOTIFICATION GATEWAY — CENTRAL CONFIGURATION
// ═══════════════════════════════════════════════════════════
// When ready to go live, replace these with real API credentials
// stored in Supabase Edge Function secrets.

// const TWILIO_CONFIG = {
//   accountSid: "YOUR_TWILIO_ACCOUNT_SID",
//   authToken: "YOUR_TWILIO_AUTH_TOKEN",
//   fromNumber: "whatsapp:+14155238886", // Twilio Sandbox or production
// };

// const RESEND_CONFIG = {
//   apiKey: "YOUR_RESEND_API_KEY",
//   fromEmail: "notifications@oasisbaklawa.com",
// };

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
 * Process pending messages in the outbox.
 * SIMULATION MODE: Waits 2s per message, then marks as 'sent'.
 *
 * To go LIVE, uncomment the Twilio / Resend sections below.
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
      // ── SIMULATION: 2-second delay ──
      await new Promise((r) => setTimeout(r, 2000));

      // ─────────────────────────────────────────────────
      // 🔌 TWILIO (WhatsApp) — Uncomment to go live
      // ─────────────────────────────────────────────────
      // if (msg.recipient_phone) {
      //   const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`;
      //   await fetch(twilioUrl, {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/x-www-form-urlencoded",
      //       Authorization: "Basic " + btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`),
      //     },
      //     body: new URLSearchParams({
      //       To: `whatsapp:${msg.recipient_phone}`,
      //       From: TWILIO_CONFIG.fromNumber,
      //       Body: msg.message_body,
      //     }),
      //   });
      // }

      // ─────────────────────────────────────────────────
      // 📧 RESEND (Email) — Uncomment to go live
      // ─────────────────────────────────────────────────
      // if (msg.recipient_email) {
      //   await fetch("https://api.resend.com/emails", {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //       Authorization: `Bearer ${RESEND_CONFIG.apiKey}`,
      //     },
      //     body: JSON.stringify({
      //       from: RESEND_CONFIG.fromEmail,
      //       to: msg.recipient_email,
      //       subject: `Oasis Notification: ${msg.event_type}`,
      //       text: msg.message_body,
      //     }),
      //   });
      // }

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
