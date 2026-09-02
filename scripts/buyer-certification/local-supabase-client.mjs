import { createClient } from "@supabase/supabase-js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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

export function assertNoSupabaseError(error, operation) {
  if (!error) return;
  const message = typeof error === "object" && error && "message" in error
    ? String(error.message)
    : String(error);
  throw new Error(`${operation}: ${message}`);
}
