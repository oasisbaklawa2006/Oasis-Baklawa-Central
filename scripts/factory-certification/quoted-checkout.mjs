/**
 * Governed Buyer checkout for Factory certification fixtures.
 * Uses Core's quotation-consent contract (customer_checkout_quote_v1, then
 * submit_customer_order_quoted_v1). The legacy submit_customer_order_v1 is
 * intentionally never called: Core #488 revokes authenticated execution of it.
 */
import { assertNoSupabaseError } from "./local-supabase-client.mjs";

const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/;

export async function submitQuotedCheckout(client, { idempotencyKey, label, requestedDispatchDate = null }) {
  const { data: quote, error: quoteError } = await client.rpc("customer_checkout_quote_v1");
  assertNoSupabaseError(quoteError, `${label} governed checkout quote failed`);
  const fingerprint = typeof quote?.fingerprint === "string" ? quote.fingerprint : "";
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error(`${label} checkout quote returned no valid fingerprint: ${JSON.stringify(quote)}`);
  }
  const { data, error } = await client.rpc("submit_customer_order_quoted_v1", {
    p_idempotency_key: idempotencyKey,
    p_quote_fingerprint: fingerprint,
    p_requested_dispatch_date: requestedDispatchDate,
  });
  assertNoSupabaseError(error, `${label} governed Buyer checkout failed`);
  return data;
}
