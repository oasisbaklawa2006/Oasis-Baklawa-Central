/**
 * Fail-closed environment policy for Factory Operations certification.
 *
 * Production credentials must never be exposed to branch-controlled preview
 * code. The full certification harness therefore defaults to localhost only.
 * A remote target is allowed only when the caller explicitly declares a
 * disposable environment id and exact host allowlist. Vercel preview hosts are
 * never accepted for credentialed Factory certification.
 */

export type FactoryCertificationTargetPolicyInput = {
  targetUrl: string;
  allowRemoteEphemeral?: boolean;
  allowedHost?: string;
  environmentId?: string;
};

export type FactoryCertificationTargetPolicyResult = {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
};

const KNOWN_PRODUCTION_HOSTS = new Set([
  "b2b.oasisbaklawa.com",
  "oasis-baklawa-central.vercel.app",
]);

// Canonical deployed Supabase project host referenced by repository runbooks
// and evidence. A production backend is never a disposable certification
// target, even when the caller enables remote certification and allowlists it.
const KNOWN_PRODUCTION_SUPABASE_HOSTS = new Set([
  "tcxvcatsqqertcnycuop.supabase.co",
]);

function validateUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function validateFactoryCertificationTarget(
  input: FactoryCertificationTargetPolicyInput,
): FactoryCertificationTargetPolicyResult {
  const url = validateUrl(input.targetUrl.trim());
  if (!url) return { valid: false, reason: "Factory certification target must be a valid http(s) URL" };

  const hostname = url.hostname.toLowerCase();
  if (KNOWN_PRODUCTION_HOSTS.has(hostname)) {
    return { valid: false, reason: `Production host ${hostname} is prohibited for credentialed Factory certification` };
  }
  if (hostname.endsWith(".vercel.app")) {
    return { valid: false, reason: "Branch-controlled Vercel preview hosts are prohibited for credentialed Factory certification" };
  }

  if (isLoopback(hostname)) {
    return { valid: true, normalizedUrl: url.origin };
  }

  if (!input.allowRemoteEphemeral) {
    return { valid: false, reason: `Remote host ${hostname} requires explicit disposable-environment authorization` };
  }
  if (!input.environmentId?.trim()) {
    return { valid: false, reason: "Remote Factory certification requires FACTORY_CERT_ENVIRONMENT_ID" };
  }
  if (!input.allowedHost?.trim()) {
    return { valid: false, reason: "Remote Factory certification requires an exact FACTORY_CERT_ALLOWED_HOST" };
  }
  if (hostname !== input.allowedHost.trim().toLowerCase()) {
    return {
      valid: false,
      reason: `Remote target host ${hostname} does not match the exact allowed host ${input.allowedHost.trim().toLowerCase()}`,
    };
  }

  return { valid: true, normalizedUrl: url.origin };
}

export type FactoryCertificationBackendPolicyInput = {
  supabaseUrl: string;
  allowRemoteEphemeral?: boolean;
  allowedSupabaseHost?: string;
  environmentId?: string;
};

export function validateFactoryCertificationBackend(
  input: FactoryCertificationBackendPolicyInput,
): FactoryCertificationTargetPolicyResult {
  const url = validateUrl(input.supabaseUrl.trim());
  if (!url) return { valid: false, reason: "Factory certification Supabase URL must be a valid http(s) URL" };

  const hostname = url.hostname.toLowerCase();
  if (KNOWN_PRODUCTION_SUPABASE_HOSTS.has(hostname)) {
    return { valid: false, reason: `Production Supabase host ${hostname} is prohibited for Factory certification` };
  }
  if (isLoopback(hostname)) return { valid: true, normalizedUrl: url.origin };

  if (!input.allowRemoteEphemeral || !input.environmentId?.trim()) {
    return { valid: false, reason: "Remote Supabase certification backend requires explicit disposable-environment authorization" };
  }
  if (!input.allowedSupabaseHost?.trim()) {
    return { valid: false, reason: "Remote Supabase certification backend requires FACTORY_CERT_ALLOWED_SUPABASE_HOST" };
  }
  if (hostname !== input.allowedSupabaseHost.trim().toLowerCase()) {
    return {
      valid: false,
      reason: `Supabase host ${hostname} does not match exact allowed host ${input.allowedSupabaseHost.trim().toLowerCase()}`,
    };
  }

  return { valid: true, normalizedUrl: url.origin };
}
