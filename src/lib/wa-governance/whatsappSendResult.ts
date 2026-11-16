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
    return { success: false, error: "INVALID_SEND_RESPONSE", data };
  }

  const response = data as Record<string, unknown>;

  if (response.acceptance_unknown === true) {
    return {
      success: false,
      acceptanceUnknown: true,
      error: "ACCEPTANCE_UNKNOWN",
      data,
    };
  }

  if (response.success === true) {
    return { success: true, data };
  }

  return {
    success: false,
    error: typeof response.error === "string" && response.error.trim()
      ? response.error
      : "SEND_NOT_CONFIRMED",
    data,
  };
}
