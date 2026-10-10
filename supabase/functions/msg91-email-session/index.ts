// MSG91 verified Buyer email -> canonical Supabase session bridge.
// The browser supplies only the MSG91 access-token and the email it attempted.
// Provider verification is repeated server-side; only the provider-confirmed
// email may select an approved B2B identity. No OTP or provider secret is exposed.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MSG91_AUTH_KEY = (Deno.env.get("MSG91_AUTH_KEY") || "").trim();
const admin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

type UnknownRecord = Record<string, unknown>;
type AuthTarget = { userId: string; mintEmail: string; isNew: boolean };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function mask(value: string) {
  const [name, domain] = value.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
}

function extractProviderVerifiedEmail(raw: UnknownRecord) {
  const message = asRecord(raw.message);
  const data = asRecord(raw.data);
  const user = asRecord(data?.user);
  const candidates = [
    typeof raw.message === "string" ? raw.message : null,
    typeof raw.data === "string" ? raw.data : null,
    message?.email,
    message?.identifier,
    data?.email,
    data?.identifier,
    raw.email,
    raw.identifier,
    user?.email,
  ];
  const email = firstString(...candidates);
  return email && email.includes("@") ? normalizeEmail(email) : null;
}

async function verifyAccessToken(accessToken: string) {
  if (!MSG91_AUTH_KEY) return { ok: false, raw: {} as UnknownRecord };
  try {
    const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: MSG91_AUTH_KEY, "access-token": accessToken }),
    });
    const raw = (await response.json().catch(() => ({}))) as UnknownRecord;
    return { ok: response.ok && raw.type === "success", raw };
  } catch (error) {
    console.error("[msg91-email-session] provider verify failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, raw: {} as UnknownRecord };
  }
}

async function mintTokenHash(email: string) {
  if (!admin) return { error: "service_role_unavailable" } as const;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data) {
    console.error("[msg91-email-session] token mint failed", error?.message || "missing_data");
    return { error: "session_token_mint_failed" } as const;
  }
  const properties = (data.properties || {}) as Record<string, unknown>;
  if (typeof properties.hashed_token === "string" && properties.hashed_token) {
    return { tokenHash: properties.hashed_token } as const;
  }
  const actionLink = typeof properties.action_link === "string" ? properties.action_link : "";
  const match = actionLink.match(/token_hash=([^&]+)/) || actionLink.match(/[?#&]token=([^&]+)/);
  return match
    ? { tokenHash: decodeURIComponent(match[1]) } as const
    : { error: "session_token_mint_failed" } as const;
}

async function resolveApprovedBuyer(email: string): Promise<AuthTarget | { error: string }> {
  if (!admin) return { error: "service_role_unavailable" };

  const { data: applications, error: appError } = await admin
    .from("b2b_applications")
    .select("id,user_id,resolved_company_id,contact_email,reviewed_at,created_at")
    .eq("status", "approved")
    .ilike("contact_email", email)
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (appError) {
    console.error("[msg91-email-session] application lookup failed", appError.message);
    return { error: "identity_lookup_failed" };
  }
  if (!applications?.length) return { error: "approved_buyer_not_found" };

  const companyIds = new Set(applications.map((row) => row.resolved_company_id).filter(Boolean).map(String));
  const boundIds = new Set(applications.map((row) => row.user_id).filter(Boolean).map(String));
  if (companyIds.size !== 1 || boundIds.size > 1) return { error: "ambiguous_email_identity" };
  if (!applications[0].resolved_company_id) return { error: "approved_application_incomplete" };

  if (boundIds.size === 1) {
    const userId = [...boundIds][0];
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError || !authData?.user) return { error: "bound_auth_identity_missing" };
    const mintEmail = authData.user.email?.trim();
    if (!mintEmail) {
      const { error: bindError } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
      if (bindError) return { error: "auth_email_bind_failed" };
      return { userId, mintEmail: email, isNew: false };
    }
    return { userId, mintEmail, isNew: false };
  }

  // No application user_id yet. Reuse exactly one public identity already bound
  // to this approved email when present; otherwise create the first Auth identity
  // only after MSG91 has verified ownership of the approved email.
  const { data: publicUsers, error: publicError } = await admin
    .from("users")
    .select("id,role,is_active,email")
    .ilike("email", email)
    .limit(10);
  if (publicError) return { error: "identity_lookup_failed" };

  const distinctIds = [...new Set((publicUsers || []).map((row) => row.id).filter(Boolean).map(String))];
  if (distinctIds.length > 1) return { error: "ambiguous_email_identity" };

  if (distinctIds.length === 1) {
    const candidate = publicUsers?.find((row) => String(row.id) === distinctIds[0]);
    const role = String(candidate?.role || "").trim().toUpperCase();
    if (candidate?.is_active !== false && role && !["PENDING", "PENDING_BUYER", "B2B_BUYER", "BUYER", "CLIENT", "CUSTOMER_USER", "SPECIAL_BUYER", "HORECA_BUYER", "WHOLESALE_BUYER", "BULK_BUYER"].includes(role)) {
      return { error: "employee_identity_conflict" };
    }
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(distinctIds[0]);
    if (!authError && authData?.user) {
      const mintEmail = authData.user.email?.trim() || email;
      if (!authData.user.email) {
        const { error: bindError } = await admin.auth.admin.updateUserById(distinctIds[0], { email, email_confirm: true });
        if (bindError) return { error: "auth_email_bind_failed" };
      }
      return { userId: distinctIds[0], mintEmail, isNew: false };
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    console.error("[msg91-email-session] auth creation failed", createError?.message || "missing_user");
    return { error: "email_identity_conflict" };
  }

  const { error: pendingError } = await admin.from("users").upsert(
    { id: created.user.id, email, role: "PENDING", is_active: true, invite_status: "pending" },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (pendingError) return { error: "pending_profile_create_failed" };

  return { userId: created.user.id, mintEmail: email, isNew: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const body = await req.json() as { accessToken?: string; email?: string; attemptId?: string };
    const accessToken = body.accessToken?.trim() || "";
    const claimedEmail = normalizeEmail(body.email || "");
    if (!accessToken || !claimedEmail || !claimedEmail.includes("@")) return json({ ok: false, error: "invalid_request" }, 400);

    const provider = await verifyAccessToken(accessToken);
    if (!provider.ok) return json({ ok: false, error: "provider_verification_failed" }, 401);

    const verifiedEmail = extractProviderVerifiedEmail(provider.raw);
    if (!verifiedEmail) return json({ ok: false, error: "verified_email_missing" }, 401);
    if (verifiedEmail !== claimedEmail) return json({ ok: false, error: "email_verification_mismatch" }, 409);

    const target = await resolveApprovedBuyer(verifiedEmail);
    if ("error" in target) return json({ ok: false, error: target.error }, target.error.includes("ambiguous") || target.error.includes("conflict") ? 409 : 403);

    const mint = await mintTokenHash(target.mintEmail);
    if ("error" in mint) return json({ ok: false, error: mint.error }, 502);

    console.log("[msg91-email-session] verified email session minted", JSON.stringify({
      attemptIdPresent: Boolean(body.attemptId),
      email: mask(verifiedEmail),
      userId: target.userId,
      isNew: target.isNew,
    }));

    return json({
      ok: true,
      user_id: target.userId,
      email: target.mintEmail,
      verified_email: verifiedEmail,
      is_new: target.isNew,
      approved_b2b_pending_claim: target.isNew,
      token_hash: mint.tokenHash,
    });
  } catch (error) {
    console.error("[msg91-email-session] fatal", error instanceof Error ? error.name : "unknown");
    return json({ ok: false, error: "email_session_bridge_failed" }, 500);
  }
});
