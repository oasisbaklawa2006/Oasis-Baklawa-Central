import { hasProviderDeliveryEvidence } from "./deliveryState";

/**
 * Fail-closed outbox queue validation for Central email processor.
 * Phone-only rows are rejected before insert — phone delivery is a Core prerequisite.
 */
export function validateOutboxRecipientForCentralQueue(params: {
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const email = params.recipientEmail?.trim();
  if (email) return { ok: true };

  const phone = params.recipientPhone?.trim();
  if (phone) {
    return { ok: false, reason: "phone_channel_unavailable_in_central" };
  }

  return { ok: false, reason: "unresolved_recipient" };
}

/**
 * Central email processor skips phone-only pending rows without marking them failed.
 * They remain pending for Core/Point24 worker authority.
 */
export function shouldSkipCentralEmailProcessing(row: {
  recipient_email: string | null;
  recipient_phone: string | null;
}): boolean {
  return !hasCentralEmailDeliveryChannel(row) && !!row.recipient_phone?.trim();
}

export function hasCentralEmailDeliveryChannel(row: {
  recipient_email: string | null;
}): boolean {
  return !!row.recipient_email?.trim();
}

/**
 * Select email-capable pending rows without letting delegated phone-only rows
 * consume batch capacity (starvation guard).
 */
export function selectEmailProcessablePendingBatch<
  T extends { recipient_email: string | null; recipient_phone?: string | null },
>(pendingRows: T[], batchSize = 50): T[] {
  const batch: T[] = [];
  for (const row of pendingRows) {
    if (!hasCentralEmailDeliveryChannel(row)) continue;
    batch.push(row);
    if (batch.length >= batchSize) break;
  }
  return batch;
}

/**
 * Transport/response failures may only transition still-pending rows to failed.
 * Evidenced provider delivery must not be overwritten by client-side catch paths.
 */
export function shouldApplyPendingFailureUpdate(row: {
  status: string | null;
  sent_at: string | null;
}): boolean {
  const status = (row.status || "pending").toLowerCase();
  if (status !== "pending") return false;
  return !hasProviderDeliveryEvidence(row);
}
