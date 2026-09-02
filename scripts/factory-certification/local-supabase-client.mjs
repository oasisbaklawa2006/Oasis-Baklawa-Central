import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Validate and canonicalize the disposable Supabase origin before any
 * privileged client is created. Certification bootstrap is intentionally
 * restricted to plain-HTTP loopback with no credentials, path, query or hash.
 *
 * @param {string} rawUrl candidate Supabase URL from the local CLI
 * @param {string} callerLabel human-readable caller name for diagnostics
 * @returns {string} validated loopback origin
 */
function resolveLocalSupabaseOrigin(rawUrl, callerLabel) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:") {
    throw new Error(`${callerLabel} is local-only; refusing Supabase protocol ${parsed.protocol}`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${callerLabel} is local-only; refusing Supabase host ${parsed.hostname}`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${callerLabel} requires a canonical loopback Supabase origin with no credentials, path, query, or fragment`);
  }
  return parsed.origin;
}

/**
 * Create the service-role Supabase client used only by the disposable local
 * certification bootstrap. The privileged key is never persisted by this
 * helper and the network target is validated before client construction.
 *
 * @param {{baseUrl: string, serviceRoleKey: string, callerLabel: string}} input
 * @returns {{client: import("@supabase/supabase-js").SupabaseClient, localSupabaseOrigin: string}}
 */
export function createLocalSupabaseAdminClient({ baseUrl, serviceRoleKey, callerLabel }) {
  const localSupabaseOrigin = resolveLocalSupabaseOrigin(baseUrl, callerLabel);
  const client = createClient(localSupabaseOrigin, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return { client, localSupabaseOrigin };
}

/**
 * Validate a local-only Postgres connection string before it is ever used.
 * Mirrors resolveLocalSupabaseOrigin's loopback restriction for the native
 * connection this helper exists for.
 *
 * @param {string} rawDbUrl candidate postgres:// URL from the local CLI
 * @param {string} callerLabel human-readable caller name for diagnostics
 * @returns {string} the validated URL, unchanged
 */
function assertLocalPostgresUrl(rawDbUrl, callerLabel) {
  const parsed = new URL(rawDbUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${callerLabel} is local-only; refusing Postgres protocol ${parsed.protocol}`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${callerLabel} is local-only; refusing Postgres host ${parsed.hostname}`);
  }
  return rawDbUrl;
}

/**
 * Execute one SQL statement as the literal `postgres` role on the disposable
 * local Supabase stack via a direct native connection (never through
 * PostgREST/service_role). This is the ONLY sanctioned path for the small set
 * of fixture rows that Core's assign_order_number_on_insert trigger
 * (20260901005700_app_e2e_order_creation_scope_hardening.sql) permits to
 * carry a pre-set order_number outside a governed order-creation RPC --
 * that trigger explicitly requires session_user='postgres' with no JWT
 * context, which the service-role PostgREST client (role 'service_role')
 * can never satisfy. Every value interpolated into `sql` must be a fixed
 * constant this script itself controls, never external input.
 *
 * @param {string} dbUrl local-only postgres:// connection string
 * @param {string} sql complete SQL statement to execute
 * @param {string} callerLabel human-readable caller name for diagnostics
 */
export function runLocalPostgresRoleStatement(dbUrl, sql, callerLabel) {
  const validatedUrl = assertLocalPostgresUrl(dbUrl, callerLabel);
  try {
    execFileSync("psql", [validatedUrl, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error?.stderr ? error.stderr.toString("utf8") : String(error?.message ?? error);
    throw new Error(`${callerLabel} failed: ${stderr.trim()}`);
  }
}

/**
 * Decode a base32 (RFC 4648) secret into raw bytes, as returned by Supabase
 * Auth's MFA TOTP enrollment response (`data.totp.secret`).
 *
 * @param {string} base32Secret
 * @returns {Buffer}
 */
function decodeBase32(base32Secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32Secret.toUpperCase().replaceAll("=", "")) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Compute an RFC 6238 TOTP code (30s step, 6 digits, HMAC-SHA1 -- Supabase
 * Auth's TOTP enrollment defaults) for a base32 secret, at a given instant.
 * Used both to verify enrollment (create-test-identities.mjs) and to step a
 * previously-enrolled session up to AAL2 at test runtime (the Playwright
 * spec), from the SAME shared secret -- never a stored/replayed code.
 *
 * @param {string} base32Secret the `totp.secret` from `auth.mfa.enroll()`
 * @param {number} [atTimeMs] instant to compute the code for, default now
 * @returns {string} 6-digit TOTP code
 */
export function computeTotpCode(base32Secret, atTimeMs = Date.now()) {
  const key = decodeBase32(base32Secret);
  const counter = Math.floor(Math.floor(atTimeMs / 1000) / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binaryCode % 1_000_000).padStart(6, "0");
}

/**
 * Convert a Supabase client error into a deterministic certification failure.
 *
 * @param {unknown} error error returned by supabase-js
 * @param {string} operation operation being certified
 */
export function assertNoSupabaseError(error, operation) {
  if (!error) return;
  const message = typeof error === "object" && error && "message" in error
    ? String(error.message)
    : String(error);
  throw new Error(`${operation}: ${message}`);
}
