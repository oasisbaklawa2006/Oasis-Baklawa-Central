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
  return !row.recipient_email?.trim() && !!row.recipient_phone?.trim();
}
