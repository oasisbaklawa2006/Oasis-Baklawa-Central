// Secure B2B User Validation Gateway
// Used by MSG91 widget to verify whether an identifier (phone/email)
// belongs to an Oasis Baklawa B2B user before sending OTP.
//
// Contract (per MSG91 spec):
//   - Always returns HTTP 200
//   - JSON: { user_found: boolean, identifier: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Normalize a phone identifier to a bare digit string for fuzzy matching.
const digitsOnly = (v: string) => v.replace(/\D+/g, "");

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

serve(async (req) => {
  // Diagnostics — visible in Supabase Edge Function logs
  console.log("[validate-user] Full Request URL:", req.url);
  console.log("[validate-user] Method:", req.method);
  try {
    console.log(
      "[validate-user] Headers Received:",
      JSON.stringify(Object.fromEntries(req.headers.entries())),
    );
  } catch (_) {
    console.log("[validate-user] Headers Received: <unserializable>");
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract identifier from GET query or POST body
  let identifier = "";
  try {
    if (req.method === "GET") {
      identifier = new URL(req.url).searchParams.get("identifier") ?? "";
    } else {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      identifier = String(
        (body as Record<string, unknown>)?.identifier ??
          (body as Record<string, unknown>)?.mobile ??
          (body as Record<string, unknown>)?.email ??
          "",
      );
    }
  } catch (_) {
    identifier = "";
  }

  identifier = identifier.trim();

  if (!identifier) {
    return jsonResponse({ user_found: false, identifier: "" });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let found = false;

    if (isEmail(identifier)) {
      const email = identifier.toLowerCase();

      const { data: u } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (u) found = true;

      if (!found) {
        const { data: a } = await supabase
          .from("b2b_applications")
          .select("id")
          .ilike("contact_email", email)
          .limit(1)
          .maybeSingle();
        if (a) found = true;
      }
    } else {
      // Phone path — match on the last 10 digits to be tolerant of
      // +91 / 0 / spaces variations stored in DB.
      const digits = digitsOnly(identifier);
      const last10 = digits.slice(-10);

      if (last10.length >= 6) {
        const pattern = `%${last10}%`;

        const { data: appHit } = await supabase
          .from("b2b_applications")
          .select("id")
          .or(
            `contact_phone.ilike.${pattern},mobile_number.ilike.${pattern}`,
          )
          .limit(1)
          .maybeSingle();
        if (appHit) found = true;

        if (!found) {
          const { data: companyHit } = await supabase
            .from("companies")
            .select("id")
            .ilike("phone", pattern)
            .limit(1)
            .maybeSingle();
          if (companyHit) found = true;
        }
      }
    }

    return jsonResponse({ user_found: found, identifier });
  } catch (err) {
    console.error("[validate-user] lookup error:", err);
    // Per contract, always 200. Fail-closed on errors.
    return jsonResponse({ user_found: false, identifier });
  }
});
