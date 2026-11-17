/**
 * Classifies the canonical Core send-whatsapp HTTP body without treating a
 * transport-level 2xx response as proof of provider acceptance or delivery.
 *
 * Unknown acceptance must remain non-retryable until the provider timeline is
 * reconciled. Deliberate resend needs an independent, authorised event key.
 */
export type WhatsAppSendResult = {
  success: boolean;
  acceptanceUnknown?: boolean;
  error?: string;
  data?: unknown;
};

export function classifyWhatsAppSendResult(data: unknown): WhatsAppSendResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      success: false,
      acceptanceUnknown: true,
      error: "INVALID_SEND_RESPONSE",
    };
  }

  const response = data as Record<string, unknown>;

  if (response.acceptance_unknown === true || response.error === "ACCEPTANCE_UNKNOWN") {
    return {
      success: false,
      acceptanceUnknown: true,
      error: "ACCEPTANCE_UNKNOWN",
      data,
    };
  }

  if (response.success === true) {
    // Core accepts a send only when the provider supplies a durable message ID.
    // An unverified "success" flag must never license another send.
    if (typeof response.messageId === "string" && response.messageId.trim()) {
      return { success: true, data };
    }
    return { success: false, acceptanceUnknown: true, error: "ACCEPTANCE_UNKNOWN" };
  }

  if (response.success === false && typeof response.error === "string" &&
      response.error.trim()) {
    // Explicit Core rejection is distinguishable from an ambiguous transport result.
    return { success: false, error: response.error, data };
  }

  return { success: false, acceptanceUnknown: true, error: "SEND_NOT_CONFIRMED" };
}

/**
 * A failed invocation does not prove the provider refused the send: the
 * network may have failed after acceptance or while serializing a response.
 * Never make an automatic second attempt without server-side reconciliation.
 */
export function classifyWhatsAppInvocationError(_error: unknown): WhatsAppSendResult {
  return { success: false, acceptanceUnknown: true, error: "ACCEPTANCE_UNKNOWN" };
}
