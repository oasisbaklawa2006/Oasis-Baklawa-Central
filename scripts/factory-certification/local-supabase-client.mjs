import { createClient } from "@supabase/supabase-js";

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
