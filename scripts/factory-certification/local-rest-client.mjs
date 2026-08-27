/**
 * Shared local-only Supabase REST client for the disposable Factory
 * certification bootstrap scripts. Every request is bound to a single
 * validated loopback origin resolved once at import time from
 * FACTORY_CERT_SUPABASE_URL; any path that would escape that origin throws
 * instead of firing the request. service_role is used here only during local
 * bootstrap, never in browser tests.
 */

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

/**
 * Creates a `request(path, init)` function bound to a single validated
 * loopback Supabase origin, plus the resolved origin itself.
 */
export function createLocalSupabaseRestClient({ baseUrl, serviceRoleKey, callerLabel, errorBodyLimit = 600 }) {
  const localSupabaseOrigin = resolveLocalSupabaseOrigin(baseUrl, callerLabel);

  function resolveLocalRequestUrl(path) {
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new Error(`${callerLabel} request path must be absolute: ${String(path)}`);
    }
    const target = new URL(path, localSupabaseOrigin);
    if (target.protocol !== "http:" || target.origin !== localSupabaseOrigin || !LOOPBACK_HOSTS.has(target.hostname)) {
      throw new Error(`${callerLabel} request escaped the approved local Supabase origin: ${target.href}`);
    }
    return target;
  }

  async function request(path, { method = "GET", body, prefer } = {}) {
    const response = await fetch(resolveLocalRequestUrl(path), {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, errorBodyLimit)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  return { request, localSupabaseOrigin };
}
