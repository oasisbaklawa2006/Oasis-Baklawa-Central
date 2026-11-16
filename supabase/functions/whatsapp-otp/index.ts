/**
 * WA-100 P0 security retirement of the historical Click2API OTP endpoint.
 *
 * This endpoint previously accepted unauthenticated requests, persisted
 * plaintext phone OTPs in public.app_settings and could mint Auth sessions.
 * Buyer and staff authentication now use the separate governed MSG91 lane.
 *
 * This tombstone deliberately never reads secrets, a request body or a phone,
 * never mints a token, writes a database row, or calls a messaging provider.
 * Keep this route fail-closed until a new contract is independently approved.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export function legacyWhatsAppOtpRetiredResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "LEGACY_WHATSAPP_OTP_RETIRED",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

if (import.meta.main) {
  serve(() => legacyWhatsAppOtpRetiredResponse());
}
