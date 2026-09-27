/**
 * Point21 — Central notification read/delivery-state contract.
 *
 * Separates:
 * - Point20 operational event truth (operational_events ledger)
 * - Point21 delivery/read state over canonical backend tables
 * - Point23 realtime transport (channel naming in UI hooks)
 * - Point24 retry/dead-letter policy (delegated — no client retry loop)
 */

/** In-app inbox (`notifications` table) read state. */
export type InAppReadState = "unread" | "read";

/**
 * Outbox/provider delivery state (`notification_outbox` table).
 * `sent` requires backend evidence (`sent_at`); never inferred from invoke success alone.
 */
export type OutboxDeliveryState = "pending" | "sent" | "failed";

export type NotificationChannel = "in_app" | "email" | "whatsapp";

export type NotificationSeverity = "low" | "normal" | "high" | "critical";

/** Canonical in-app notification row projection. */
export interface InAppNotificationRecord {
  id: string;
  type: string | null;
  message: string | null;
  createdAt: string | null;
  readState: InAppReadState;
  userId: string | null;
  companyId: string | null;
}

/** Canonical outbox delivery projection (read-only in Central). */
export interface OutboxDeliveryRecord {
  id: string;
  eventType: string | null;
  messageBody: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  priority: string | null;
  deliveryState: OutboxDeliveryState;
  /** ISO timestamp from backend when delivery is evidenced. */
  sentAt: string | null;
  errorLog: string | null;
  createdAt: string | null;
  /** True only when deliveryState is sent and sentAt is present. */
  providerDeliveryEvident: boolean;
}

export interface NotificationRecipientScope {
  userId: string;
  companyId: string | null;
}

export type RecipientScopeResolution =
  | { ok: true; scope: NotificationRecipientScope }
  | { ok: false; reason: string };

export type NotifyEventValidation =
  | { ok: true }
  | { ok: false; reason: string };
