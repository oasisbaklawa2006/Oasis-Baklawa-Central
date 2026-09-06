import { supabase } from "@/integrations/supabase/client";
import { hasProviderDeliveryEvidence } from "@/lib/notification-infrastructure/deliveryState";
import {
  shouldSkipCentralEmailProcessing,
  validateOutboxRecipientForCentralQueue,
} from "@/lib/notification-infrastructure/outboxQueueValidation";
import type { Database } from "@/integrations/supabase/database.types";

type OutboxInsert = Database["public"]["Tables"]["notification_outbox"]["Insert"];
type OutboxUpdate = Database["public"]["Tables"]["notification_outbox"]["Update"];

// ═══════════════════════════════════════════════════════════
// NOTIFICATION GATEWAY — LIVE CONFIGURATION
// Email sending is handled by the send-email Edge Function.
// Delivery state updates require backend/provider evidence (Point21).
// Retry/dead-letter is delegated to Point24 — no client retry loop.
// ═══════════════════════════════════════════════════════════

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
  const validation = validateOutboxRecipientForCentralQueue({
    recipientEmail: params.recipientEmail,
    recipientPhone: params.recipientPhone,
  });
  if (validation.ok === false) {
    console.error("[Outbox] Failed to queue notification:", validation.reason);
    return { queued: false, reason: validation.reason };
  }

  const payload: OutboxInsert = {
    event_type: params.eventType,
    message_body: params.messageBody,
    recipient_phone: params.recipientPhone || null,
    recipient_email: params.recipientEmail || null,
    priority: params.priority || "normal",
    status: "pending",
  };

  const { error } = await supabase.from("notification_outbox").insert(payload);

  if (error) {
    console.error("[Outbox] Failed to queue notification:", error.message);
    return { queued: false, reason: error.message };
  }
  return { queued: true as const };
};

type SendEmailResponse = { success?: boolean; id?: string; error?: string };

/**
 * Process pending messages in the outbox — LIVE MODE.
 * Passes outboxId to send-email so status is updated only with provider evidence.
 * Central does not mark sent on invoke-only success.
 */
export const processOutboxQueue = async (): Promise<number> => {
  const { data: pending } = await supabase
    .from("notification_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!pending || pending.length === 0) return 0;

  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (!session || authError) {
    console.error("[Outbox] No active session — cannot process queue.");
    return 0;
  }

  let processed = 0;

  for (const msg of pending) {
    try {
      if (shouldSkipCentralEmailProcessing(msg)) {
        continue;
      }

      if (!msg.recipient_email) {
        continue;
      }

      const { data, error: emailError } = await supabase.functions.invoke<SendEmailResponse>(
        "send-email",
        {
          body: {
            to: msg.recipient_email,
            subject: `Oasis Notification: ${msg.event_type}`,
            text: msg.message_body,
            outboxId: msg.id,
          },
        },
      );

      if (emailError) {
        throw new Error(emailError.message || "Edge Function email error");
      }

      if (!data?.success) {
        throw new Error(data?.error || "send-email returned without success evidence");
      }

      const { data: refreshed } = await supabase
        .from("notification_outbox")
        .select("status, sent_at")
        .eq("id", msg.id)
        .maybeSingle();

      if (refreshed && hasProviderDeliveryEvidence(refreshed)) {
        processed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const failureUpdate: OutboxUpdate = { status: "failed", error_log: message };
      await supabase.from("notification_outbox").update(failureUpdate).eq("id", msg.id);
    }
  }

  return processed;
};
