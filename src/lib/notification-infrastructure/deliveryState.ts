import type { Database } from "@/integrations/supabase/database.types";
import type {
  InAppNotificationRecord,
  InAppReadState,
  OutboxDeliveryRecord,
  OutboxDeliveryState,
} from "./contract";

export type NotificationsRow = Database["public"]["Tables"]["notifications"]["Row"];
export type OutboxRow = Database["public"]["Tables"]["notification_outbox"]["Row"];

export function normalizeInAppReadState(isRead: boolean | null | undefined): InAppReadState {
  return isRead ? "read" : "unread";
}

/**
 * Map raw outbox status to canonical delivery state.
 * Never treat invoke-only success as sent — requires status + sent_at evidence.
 */
export function normalizeOutboxDeliveryState(row: {
  status: string | null;
  sent_at: string | null;
}): OutboxDeliveryState {
  const status = (row.status || "pending").toLowerCase();
  if (status === "failed") return "failed";
  if (status === "sent" && row.sent_at) return "sent";
  return "pending";
}

export function hasProviderDeliveryEvidence(row: {
  status: string | null;
  sent_at: string | null;
}): boolean {
  return normalizeOutboxDeliveryState(row) === "sent";
}

export function projectInAppNotification(row: NotificationsRow): InAppNotificationRecord {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
    readState: normalizeInAppReadState(row.is_read),
    userId: row.user_id,
    companyId: row.company_id,
  };
}

export function projectOutboxDelivery(row: OutboxRow): OutboxDeliveryRecord {
  const deliveryState = normalizeOutboxDeliveryState(row);
  const providerDeliveryEvident = deliveryState === "sent";
  return {
    id: row.id,
    eventType: row.event_type,
    messageBody: row.message_body,
    recipientEmail: row.recipient_email,
    recipientPhone: row.recipient_phone,
    priority: row.priority,
    deliveryState,
    sentAt: providerDeliveryEvident ? row.sent_at : null,
    errorLog: row.error_log,
    createdAt: row.created_at,
    providerDeliveryEvident,
  };
}

/**
 * UI label helper — never claim "Delivered" without provider evidence.
 */
export function outboxDeliveryLabel(record: OutboxDeliveryRecord): string {
  if (record.providerDeliveryEvident) return "sent";
  if (record.deliveryState === "failed") return "failed";
  return "pending";
}
