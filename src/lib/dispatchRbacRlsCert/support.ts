import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { validateFactoryCertificationBackend } from "@/lib/factoryCertificationEnvironmentPolicy";

/** Intentionally public production client values (same as quality-gate.yml). */
export const PRODUCTION_SUPABASE_URL = "https://tcxvcatsqqertcnycuop.supabase.co";
export const PRODUCTION_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_UbNV2X25YHY3cupjpoLsjw_RhlDG4f_";

export type RlsCertCredentials = {
  email: string;
  password: string;
};

function readFactoryCertCredentials(role: string): RlsCertCredentials | null {
  const canonical = role.trim().toUpperCase();
  const email = process.env[`FACTORY_CERT_${canonical}_EMAIL`]?.trim();
  const password = process.env[`FACTORY_CERT_${canonical}_PASSWORD`]?.trim();
  if (!email || !password) return null;
  return { email, password };
}

function hasFactoryCertificationBackend(): boolean {
  return Boolean(
    process.env.FACTORY_CERT_SUPABASE_URL?.trim() &&
      process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim(),
  );
}

function resolveFactoryCertificationBackend(): { url: string; anonKey: string } {
  const supabaseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
  const anonKey = process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_SUPABASE_URL / FACTORY_CERT_SUPABASE_ANON_KEY missing");
  }
  const policy = validateFactoryCertificationBackend({
    supabaseUrl,
    allowRemoteEphemeral: process.env.FACTORY_CERT_ALLOW_REMOTE_EPHEMERAL === "true",
    allowedSupabaseHost: process.env.FACTORY_CERT_ALLOWED_SUPABASE_HOST,
    environmentId: process.env.FACTORY_CERT_ENVIRONMENT_ID,
  });
  if (!policy.valid || !policy.normalizedUrl) {
    throw new Error(`UNSAFE_CERTIFICATION_BACKEND: ${policy.reason ?? "backend rejected"}`);
  }
  return { url: policy.normalizedUrl, anonKey };
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function isDispatchRlsCertRequired(): boolean {
  return process.env.DISPATCH_RLS_CERT_REQUIRED === "true";
}

export function hasDispatchRlsCertBackend(): boolean {
  return true;
}

export function resolveDispatchRlsCertBackend(): { url: string; anonKey: string } {
  if (hasFactoryCertificationBackend()) {
    return resolveFactoryCertificationBackend();
  }
  return {
    url: process.env.DISPATCH_RLS_CERT_SUPABASE_URL?.trim() || PRODUCTION_SUPABASE_URL,
    anonKey:
      process.env.DISPATCH_RLS_CERT_SUPABASE_ANON_KEY?.trim() ||
      PRODUCTION_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function readDispatchRlsCertDispatchCredentials(): RlsCertCredentials | null {
  const testEmail = process.env.TEST_DISPATCH_EMAIL?.trim();
  const testPassword = process.env.TEST_DISPATCH_PASSWORD?.trim();
  if (testEmail && testPassword) {
    return { email: testEmail, password: testPassword };
  }
  return readFactoryCertCredentials("DISPATCH_MANAGER");
}

export function readDispatchRlsCertCleanupCredentials(): RlsCertCredentials | null {
  const testEmail = process.env.TEST_ADMIN_EMAIL?.trim();
  const testPassword = process.env.TEST_ADMIN_PASSWORD?.trim();
  if (testEmail && testPassword) {
    return { email: testEmail, password: testPassword };
  }
  return readFactoryCertCredentials("SUPER_ADMIN") ?? readFactoryCertCredentials("ADMIN");
}

export function createDispatchRlsCertClient(
  _credentials: RlsCertCredentials,
): SupabaseClient<Database> {
  const backend = resolveDispatchRlsCertBackend();
  return createClient<Database>(backend.url, backend.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function signInDispatchRlsCertClient(
  client: SupabaseClient<Database>,
  credentials: RlsCertCredentials,
  label: string,
): Promise<SupabaseClient<Database>> {
  const { error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) {
    throw new Error(`AUTH_FAILED ${label}: ${error.message}`);
  }
  return client;
}

let cachedFixtureOrderId: string | null = null;

export async function resolveDispatchRlsFixtureOrderId(
  adminClient: SupabaseClient<Database>,
): Promise<string> {
  if (cachedFixtureOrderId) return cachedFixtureOrderId;

  const explicit =
    process.env.DISPATCH_RLS_CERT_ORDER_ID?.trim() ||
    process.env.FACTORY_CERT_POINT38_ORDER_ID?.trim() ||
    process.env.FACTORY_CERT_GOLDEN_ORDER_ID?.trim() ||
    process.env.FACTORY_CERT_POINT37_ORDER_ID?.trim();
  if (explicit) {
    cachedFixtureOrderId = explicit;
    console.log(`DISPATCH_RLS_CERT_FIXTURE source=explicit order_hash=${hashIdentifier(explicit)}`);
    return explicit;
  }

  const { data, error } = await adminClient
    .from("order_items")
    .select("order_id")
    .not("product_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`FIXTURE_DISCOVERY_FAILED: code=${error.code ?? "unknown"}`);
  }
  if (!data?.order_id) {
    throw new Error("FIXTURE_DISCOVERY_FAILED: no readable order_items row found under admin authority");
  }

  cachedFixtureOrderId = data.order_id;
  console.log(`DISPATCH_RLS_CERT_FIXTURE source=discovered order_hash=${hashIdentifier(data.order_id)}`);
  return data.order_id;
}

export function sanitizeProbeDetail(detail: string): string {
  if (!detail || detail === "insert succeeded") return "insert_succeeded";
  const codeMatch = detail.match(/\bcode=([0-9A-Z]{5})\b/i);
  if (codeMatch) return `postgres_code=${codeMatch[1]}`;
  if (detail.toLowerCase().includes("permission denied")) return "permission_denied";
  if (detail.toLowerCase().includes("row-level security")) return "rls_denied";
  return "authorization_classified";
}
