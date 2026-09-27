import type { NotificationChannel } from "./contract";

export interface DedupeIdentityParts {
  channel: NotificationChannel;
  eventKey: string;
  recipientKey: string;
  entityRef?: string | null;
}

/**
 * Deterministic dedupe identity for notification enqueue (client-side advisory).
 * Backend idempotency_key column is a Core prerequisite; this key is stable for
 * Central contract tests and future Core alignment.
 */
export function buildNotificationDedupeKey(parts: DedupeIdentityParts): string {
  const eventKey = parts.eventKey.trim().toLowerCase();
  const recipientKey = parts.recipientKey.trim().toLowerCase();
  const entityRef = (parts.entityRef?.trim() || "none").toLowerCase();
  return `${parts.channel}:${eventKey}:${recipientKey}:${entityRef}`;
}

export function normalizeDedupeRecipientKey(params: {
  userId?: string | null;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
}): string | null {
  if (params.userId?.trim()) return `user:${params.userId.trim()}`;
  if (params.companyId?.trim()) return `company:${params.companyId.trim()}`;
  if (params.email?.trim()) return `email:${params.email.trim().toLowerCase()}`;
  if (params.phone?.trim()) return `phone:${params.phone.trim()}`;
  return null;
}
