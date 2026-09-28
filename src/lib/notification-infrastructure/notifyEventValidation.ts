import type { NotifyAudience, NotifyEventParams } from "@/utils/notifyEvent";
import type { NotifyEventValidation } from "./contract";
import { normalizeDedupeRecipientKey } from "./dedupeIdentity";

const VALID_AUDIENCES: NotifyAudience[] = ["buyer", "sales_exec", "admin"];

/**
 * Fail closed before invoking notify-event edge function.
 * Central does not send when recipient/scope cannot be resolved.
 */
export function validateNotifyEventParams(params: NotifyEventParams): NotifyEventValidation {
  const event = params.event?.trim();
  if (!event) return { ok: false, reason: "missing_event" };

  if (event === "approval_granted") {
    const applicationId = params.applicationId?.trim();
    if (!applicationId) return { ok: false, reason: "missing_application_id" };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) {
      return { ok: false, reason: "invalid_application_id" };
    }
    const carriesCallerAuthority = !!(
      params.subject?.trim() ||
      params.message?.trim() ||
      params.email?.trim() ||
      params.phone?.trim() ||
      params.orderId?.trim() ||
      params.companyId?.trim() ||
      (params.audiences?.length ?? 0) > 0
    );
    if (carriesCallerAuthority) {
      return { ok: false, reason: "approval_payload_must_use_application_authority" };
    }
    return { ok: true };
  }

  const subject = params.subject?.trim();
  if (!subject) return { ok: false, reason: "missing_subject" };

  const message = params.message?.trim();
  if (!message) return { ok: false, reason: "missing_message" };

  const audiences = params.audiences ?? [];
  const hasDirectContact = !!(params.email?.trim() || params.phone?.trim());
  const hasOrderContext = !!(params.orderId?.trim() || params.companyId?.trim());

  if (audiences.length === 0 && !hasDirectContact && !hasOrderContext) {
    return { ok: false, reason: "unresolved_recipient_scope" };
  }

  for (const audience of audiences) {
    if (!VALID_AUDIENCES.includes(audience)) {
      return { ok: false, reason: `invalid_audience:${audience}` };
    }
  }

  if (hasDirectContact) {
    const recipientKey = normalizeDedupeRecipientKey({
      email: params.email,
      phone: params.phone,
    });
    if (!recipientKey) {
      return { ok: false, reason: "invalid_direct_contact" };
    }
  }

  return { ok: true };
}
