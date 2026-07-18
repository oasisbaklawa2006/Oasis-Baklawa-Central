import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveSigningSecret, verifyHmacSignature } from "../_shared/barcode-scan-ingest/hmac.ts";
import {
  createSupabaseBarcodeScanIngestDb,
  processBarcodeScanIngest,
  resolveIngestHttpStatus,
  validateIngestHeaders,
} from "../_shared/barcode-scan-ingest/ingest.ts";
import type { BarcodeScanIngestResponse } from "../_shared/barcode-scan-ingest/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-source-app, x-idempotency-key, x-oasis-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: BarcodeScanIngestResponse | Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed", message: "POST required" }, 405);
  }

  const rawBody = await req.text();
  const headers = {
    sourceApp: req.headers.get("X-Source-App") ?? "",
    idempotencyKey: req.headers.get("X-Idempotency-Key") ?? "",
    signature: req.headers.get("X-Oasis-Signature") ?? "",
  };

  const headerError = validateIngestHeaders(headers);
  if (headerError) {
    return jsonResponse(headerError, resolveIngestHttpStatus(headerError.reason));
  }

  const secret = resolveSigningSecret({
    BARCODE_APP_SCAN_SIGNING_SECRET: Deno.env.get("BARCODE_APP_SCAN_SIGNING_SECRET") ?? undefined,
    CENTRAL_SCAN_SIGNING_SECRET: Deno.env.get("CENTRAL_SCAN_SIGNING_SECRET") ?? undefined,
  });

  const hmac = await verifyHmacSignature({
    body: rawBody,
    idempotencyKey: headers.idempotencyKey,
    requireIdempotencyKey: true,
    signatureHeader: headers.signature,
    secret,
  });

  if (!hmac.ok) {
    const reason = hmac.reason ?? "signature_invalid";
    const message =
      reason === "signing_secret_missing"
        ? "Server signing secret is not configured"
        : reason === "signature_missing"
          ? "X-Oasis-Signature is required"
          : reason === "missing_idempotency_key"
            ? "X-Idempotency-Key is required"
            : "Invalid HMAC signature";
    return jsonResponse({ ok: false, reason, message }, resolveIngestHttpStatus(reason));
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_json", message: "Request body must be valid JSON" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const result = await processBarcodeScanIngest({
      headers,
      payload,
      idempotencyKey: headers.idempotencyKey.trim(),
      submittedAt: new Date().toISOString(),
      db: createSupabaseBarcodeScanIngestDb(supabase),
    });

    if (!result.ok) {
      return jsonResponse(result, resolveIngestHttpStatus(result.reason));
    }

    return jsonResponse(result, 200);
  } catch (err) {
    console.error("[barcode-scan-ingest] unexpected error:", err);
    return jsonResponse(
      { ok: false, reason: "internal_error", message: "Unable to record scan" },
      500,
    );
  }
});
