// Server-attested GSTIN verification. Requires Authorization: Bearer <user JWT>.
// Writes to gstin_verification_attestations via service role (clients cannot spoof).
//
// Env (configure per your GST/KYC vendor):
//   GST_VERIFY_URL          — URL with {{gstin}} placeholder (e.g. https://api.vendor.com/gst/{{gstin}})
//   GST_VERIFY_HTTP_METHOD  — GET | POST (default POST)
//   GST_VERIFY_API_KEY      — optional; sent as Authorization: Bearer <key>
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY — auto in Edge
//
// Expected upstream JSON (flexible): we normalize common shapes; you may place a tiny adapter
// in front of your vendor to return { "registration_status": "active"|"cancelled"|"suspended"|"invalid", ... }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeGstin(raw: string): string {
  return raw.trim().toUpperCase();
}

function dig(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function coerceStatus(raw: unknown, activeHint?: boolean): string {
  if (typeof activeHint === "boolean") {
    return activeHint ? "active" : "invalid";
  }
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "unknown";
  if (s === "active" || s === "a" || s === "act") return "active";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("suspend")) return "suspended";
  if (s.includes("inact") || s === "inactive" || s === "invalid" || s === "i") return "invalid";
  return "unknown";
}

function normalizeProviderPayload(data: unknown): {
  registration_status: string;
  snapshot: Record<string, unknown>;
} {
  if (!data || typeof data !== "object") {
    return { registration_status: "unknown", snapshot: { raw: "non_object" } };
  }
  const o = data as Record<string, unknown>;

  const explicit = o.registration_status ?? o.status ?? dig(o, "data.registration_status") ?? dig(o, "data.status");
  const sts = dig(o, "taxpayerDetails.sts") ?? dig(o, "result.taxpayerDetails.sts") ?? o.sts ?? dig(o, "data.sts");
  const activeFlag = typeof o.active === "boolean"
    ? o.active
    : typeof dig(o, "data.active") === "boolean"
    ? dig(o, "data.active") as boolean
    : undefined;

  const legalName = o.legal_name ?? o.legalName ?? o.lgnm ?? dig(o, "taxpayerDetails.lgnm") ?? dig(o, "data.lgnm");
  const tradeName = o.trade_name ?? o.tradeName ?? o.tradeNam ?? dig(o, "taxpayerDetails.tradeNam");
  const addr = o.principal_address ?? o.principalAddress ?? dig(o, "taxpayerDetails.pradr") ?? dig(o, "pradr");

  let registration_status = typeof explicit === "string"
    ? coerceStatus(explicit)
    : coerceStatus(sts, activeFlag);

  if (o.error && typeof o.error === "string") {
    registration_status = "invalid";
  }
  if (o.success === false) {
    registration_status = registration_status === "unknown" ? "invalid" : registration_status;
  }

  const snapshot: Record<string, unknown> = {
    legal_name: legalName ?? null,
    trade_name: tradeName ?? null,
    principal_address: addr ?? null,
    provider_raw_status: explicit ?? sts ?? null,
  };

  return { registration_status, snapshot };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  let body: { gstin?: string; manual_offline_confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const gstin = normalizeGstin(body.gstin ?? "");
  if (!GSTIN_RE.test(gstin)) {
    return jsonResponse({ ok: false, error: "invalid_gstin_format" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (body.manual_offline_confirm === true) {
    const snapshot = {
      source: "manual_offline_ack",
      acknowledged_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from("gstin_verification_attestations").upsert(
      {
        user_id: userId,
        gstin,
        registration_status: "unverified_offline",
        snapshot,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,gstin" },
    );
    if (upErr) {
      console.error("[verify-gstin] manual upsert failed", upErr);
      return jsonResponse({ ok: false, error: "persist_failed" }, 500);
    }
    return jsonResponse({
      ok: true,
      registration_status: "unverified_offline",
      legal_name: null,
      trade_name: null,
      manual_offline: true,
    });
  }

  const verifyUrlTemplate = Deno.env.get("GST_VERIFY_URL")?.trim() ?? "";
  const method = (Deno.env.get("GST_VERIFY_HTTP_METHOD") ?? "POST").toUpperCase();
  const apiKey = Deno.env.get("GST_VERIFY_API_KEY")?.trim() ?? "";

  if (!verifyUrlTemplate) {
    return jsonResponse({
      ok: false,
      error: "provider_not_configured",
      code: "provider_unavailable",
    }, 503);
  }

  const url = verifyUrlTemplate.replace(/\{\{gstin\}\}/gi, encodeURIComponent(gstin));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let providerJson: unknown;
  try {
    const res = method === "GET"
      ? await fetch(url, { method: "GET", headers })
      : await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ gstin }),
      });

    if (!res.ok) {
      console.error("[verify-gstin] provider http", res.status);
      return jsonResponse({
        ok: false,
        error: "provider_http_error",
        code: "provider_unavailable",
        status: res.status,
      }, 502);
    }

    providerJson = await res.json();
  } catch (e) {
    console.error("[verify-gstin] provider fetch failed", e);
    return jsonResponse({
      ok: false,
      error: "provider_unreachable",
      code: "provider_unavailable",
    }, 502);
  }

  const { registration_status, snapshot } = normalizeProviderPayload(providerJson);

  const snapshotOut = {
    ...snapshot,
    normalized_registration_status: registration_status,
    verified_via: "provider",
  };

  const verifiedAt = new Date().toISOString();

  const { error: upErr } = await admin.from("gstin_verification_attestations").upsert(
    {
      user_id: userId,
      gstin,
      registration_status,
      snapshot: snapshotOut,
      verified_at: verifiedAt,
      updated_at: verifiedAt,
    },
    { onConflict: "user_id,gstin" },
  );

  if (upErr) {
    console.error("[verify-gstin] upsert failed", upErr);
    return jsonResponse({ ok: false, error: "persist_failed" }, 500);
  }

  const legalName = snapshotOut.legal_name;
  const tradeName = snapshotOut.trade_name;
  const principalAddress = snapshotOut.principal_address ?? null;
  const stcd = typeof principalAddress === "object" && principalAddress !== null
    ? (principalAddress as Record<string, unknown>).stcd
    : undefined;
  const stateHint = typeof stcd === "string" ? stcd : null;

  return jsonResponse({
    ok: true,
    registration_status,
    legal_name: typeof legalName === "string" ? legalName : null,
    trade_name: typeof tradeName === "string" ? tradeName : null,
    principal_address: principalAddress,
    state_hint: stateHint,
    blocked: registration_status === "cancelled" || registration_status === "suspended" ||
      registration_status === "invalid",
  });
});
