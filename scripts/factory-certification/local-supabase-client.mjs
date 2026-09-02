import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { computeTotpCode } from "./totp.mjs";

export { computeTotpCode };

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
 * The connection string is never passed as a process argument (a plain
 * command-line argument is visible to every other local process via
 * /proc or `ps`, including any password embedded in the URL) -- its parts
 * are passed via the PG* environment variables psql itself reads instead.
 *
 * @param {string} dbUrl local-only postgres:// connection string
 * @param {string} sql complete SQL statement to execute
 * @param {string} callerLabel human-readable caller name for diagnostics
 */
export function runLocalPostgresRoleStatement(dbUrl, sql, callerLabel) {
  const validatedUrl = assertLocalPostgresUrl(dbUrl, callerLabel);
  const parsed = new URL(validatedUrl);
  try {
    execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || "5432",
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
      },
    });
  } catch (error) {
    const stderr = error?.stderr ? error.stderr.toString("utf8") : String(error?.message ?? error);
    throw new Error(`${callerLabel} failed: ${stderr.trim()}`);
  }
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
