/**
 * WO-TB-02 — GET /api/runtime-attestation
 *
 * Serves the build-time manifest packaged via vercel.json `includeFiles`.
 * Deliberately does NOT read import.meta.env or any client config env var:
 * the answer describes the baked SPA bundle, not Function runtime settings.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const MANIFEST_RELATIVE_PATH = "server-only/torch-attestation.manifest.json";
const FLAG_ALLOWLIST = ["isRealtimeEnabled"] as const;
const KEYS = ["app", "gitSha", "environment", "supabaseProjectRef", "activeFeatureFlags", "demoMode"];

const HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function respond(status: number, body?: unknown, extra: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Hash both sides so timingSafeEqual always compares equal-length buffers.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Strict validation; returns a fresh object with exactly the 6 contract keys, or null. */
function validate(raw: unknown): Record<string, unknown> | null {
  if (!isObj(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== KEYS.length || !KEYS.every((k) => keys.includes(k))) return null;
  const { app, gitSha, environment, supabaseProjectRef, activeFeatureFlags, demoMode } = raw;
  if (app !== "central") return null;
  if (typeof gitSha !== "string" || !/^[0-9a-f]{40}$/.test(gitSha)) return null;
  if (environment !== "production" && environment !== "preview" && environment !== "development") return null;
  if (typeof demoMode !== "boolean") return null;
  if (demoMode) {
    if (supabaseProjectRef !== null) return null;
  } else if (typeof supabaseProjectRef !== "string" || !/^[a-z0-9]{20}$/.test(supabaseProjectRef)) {
    return null;
  }
  if (!isObj(activeFeatureFlags)) return null;
  const flagKeys = Object.keys(activeFeatureFlags);
  if (flagKeys.length !== FLAG_ALLOWLIST.length) return null;
  const flags: Record<string, boolean> = {};
  for (const name of FLAG_ALLOWLIST) {
    const v = activeFeatureFlags[name];
    if (typeof v !== "boolean") return null; // unknown/missing must not coerce to false
    flags[name] = v;
  }
  return { app, gitSha, environment, supabaseProjectRef, activeFeatureFlags: flags, demoMode };
}

function loadManifest(): Record<string, unknown> | null {
  const candidates = [
    path.join(process.cwd(), MANIFEST_RELATIVE_PATH),
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", MANIFEST_RELATIVE_PATH),
  ];
  for (const file of candidates) {
    try {
      return validate(JSON.parse(readFileSync(file, "utf8")));
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export default {
  fetch(request: Request): Response {
    if (request.method !== "GET") return respond(405, undefined, { Allow: "GET" });

    const expected = process.env.TORCH_ATTEST_TOKEN;
    if (!expected) return respond(503); // server misconfigured: fail closed, no metadata
    if (!tokenMatches(request.headers.get("x-torch-attest-token"), expected)) return respond(401);

    const manifest = loadManifest();
    if (!manifest) return respond(503);
    return respond(200, manifest);
  },
};
