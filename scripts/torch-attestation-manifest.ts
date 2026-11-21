/**
 * WO-TB-02 — build-time runtime attestation manifest.
 *
 * Runs inside `vite build` (see vite.config.ts) and records what the SPA bundle
 * was actually baked with. The manifest is written OUTSIDE dist/ and public/ so
 * it is never served as a static asset; api/runtime-attestation.ts packages it
 * through vercel.json `includeFiles` and serves it verbatim.
 *
 * Fail-closed: any invalid input removes the manifest (API then answers 503).
 * Nothing here ever defaults an unknown value to `false` or a guessed ref.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export const MANIFEST_RELATIVE_PATH = "server-only/torch-attestation.manifest.json";

/** The only allowlisted flag: baked into the SPA bundle as a literal in this source file. */
export const REALTIME_FLAG_FILE = "src/hooks/useRealtime.ts";

export type AttestationEnvironment = "production" | "preview" | "development";

export interface AttestationManifest {
  app: "central";
  gitSha: string;
  environment: AttestationEnvironment;
  supabaseProjectRef: string | null; // always a ref: no-boot configs produce no manifest
  activeFeatureFlags: { isRealtimeEnabled: boolean };
  demoMode: boolean;
}

const SHA_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[a-z0-9]{20}$/;
const KEY_RE = /^[A-Za-z0-9._-]{16,}$/;
const ENVIRONMENTS: readonly string[] = ["production", "preview", "development"];

export function resolveGitSha(env: NodeJS.ProcessEnv, root: string): string {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (fromEnv) return fromEnv;
  return execSync("git rev-parse HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim()
    .toLowerCase();
}

export function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function readIsRealtimeEnabled(root: string): boolean {
  const src = readFileSync(path.join(root, REALTIME_FLAG_FILE), "utf8");
  const m = /export\s+const\s+isRealtimeEnabled\s*(?::\s*boolean\s*)?=\s*(true|false)\s*;/.exec(src);
  if (!m) throw new Error(`isRealtimeEnabled is not a literal boolean in ${REALTIME_FLAG_FILE}; refusing to guess`);
  return m[1] === "true";
}

export function buildManifest(
  viteEnv: Record<string, string>,
  procEnv: NodeJS.ProcessEnv,
  root: string,
): AttestationManifest {
  const gitSha = resolveGitSha(procEnv, root);
  if (!SHA_RE.test(gitSha)) throw new Error("gitSha is not a 40-char lowercase hex SHA");

  const vercelEnv = procEnv.VERCEL_ENV;
  // Non-Vercel builds never claim production/preview.
  const environment = vercelEnv ?? "development";
  if (!ENVIRONMENTS.includes(environment)) throw new Error(`invalid environment "${environment}"`);

  // Boot truth: client.ts needs BOTH a Supabase URL and the publishable key. Either missing/invalid -> no manifest.
  const supabaseProjectRef = projectRefFromUrl(viteEnv.VITE_SUPABASE_URL);
  if (!supabaseProjectRef || !REF_RE.test(supabaseProjectRef)) {
    throw new Error("VITE_SUPABASE_URL does not yield a valid 20-char supabase project ref");
  }
  if (!KEY_RE.test(viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is missing or malformed");
  }
  const id = viteEnv.VITE_SUPABASE_PROJECT_ID;
  if (id && id !== supabaseProjectRef) throw new Error("VITE_SUPABASE_PROJECT_ID disagrees with VITE_SUPABASE_URL");

  const activeFeatureFlags = { isRealtimeEnabled: readIsRealtimeEnabled(root) };

  return { app: "central", gitSha, environment: environment as AttestationEnvironment, supabaseProjectRef, activeFeatureFlags, demoMode: false };
}

export function torchAttestationPlugin(loadEnv: (mode: string) => Record<string, string>): Plugin {
  let root = process.cwd();
  let mode = "production";
  return {
    name: "torch-runtime-attestation",
    apply: "build",
    configResolved(cfg) {
      root = cfg.root;
      mode = cfg.mode;
    },
    buildStart() {
      // Remove any stale manifest so a failed/aborted build can never attest an old bundle.
      rmSync(path.join(root, MANIFEST_RELATIVE_PATH), { force: true });
    },
    closeBundle() {
      const target = path.join(root, MANIFEST_RELATIVE_PATH);
      try {
        const manifest = buildManifest(loadEnv(mode), process.env, root);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
      } catch (err) {
        rmSync(target, { force: true });
        console.error(`[torch-attestation] manifest NOT written (API will answer 503): ${(err as Error).message}`);
      }
    },
  };
}
