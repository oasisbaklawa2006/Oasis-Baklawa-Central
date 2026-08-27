import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DatabaseWithCanonicalProductionDepartment } from "../../src/lib/production-jobs/productionJobsDatabase";
import type { FactoryRouteEntry } from "../../src/lib/factoryOperationsRouteRegistry";
import { FACTORY_OPERATIONS_ROUTES } from "../../src/lib/factoryOperationsRouteRegistry";
import {
  factoryCertificationCredentialSpec,
  findDuplicateCertificationEmails,
} from "../../src/lib/factoryCertificationCredentialPolicy";
import {
  validateFactoryCertificationBackend,
  validateFactoryCertificationTarget,
} from "../../src/lib/factoryCertificationEnvironmentPolicy";

export type FactoryCertificationCredentials = {
  role: string;
  email: string;
  password: string;
};

export type FactoryCertificationViewport = {
  name: "mobile" | "tablet" | "desktop" | "tv";
  width: number;
  height: number;
};

export type FactoryProductionJobTruth = {
  id: string;
  canonical_department: string | null;
  status: string;
  assigned_qty: number;
  produced_qty: number | null;
  priority: string;
  order_id: string | null;
};

const OPEN_PRODUCTION_STATUSES = ["pending", "accepted", "in_production", "paused"];

function isRemoteEphemeralAllowed(): boolean {
  return process.env.FACTORY_CERT_ALLOW_REMOTE_EPHEMERAL === "true";
}

export function hasFactoryCertificationTarget(): boolean {
  return Boolean(process.env.FACTORY_CERT_TARGET_URL?.trim());
}

export function resolveFactoryCertificationTarget(): string {
  const targetUrl = process.env.FACTORY_CERT_TARGET_URL?.trim();
  if (!targetUrl) throw new Error("CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL is missing");

  const policy = validateFactoryCertificationTarget({
    targetUrl,
    allowRemoteEphemeral: isRemoteEphemeralAllowed(),
    allowedHost: process.env.FACTORY_CERT_ALLOWED_HOST,
    environmentId: process.env.FACTORY_CERT_ENVIRONMENT_ID,
  });
  if (!policy.valid || !policy.normalizedUrl) {
    throw new Error(`UNSAFE_CERTIFICATION_TARGET: ${policy.reason ?? "target rejected"}`);
  }
  return policy.normalizedUrl;
}

export function hasFactoryCertificationBackend(): boolean {
  return Boolean(
    process.env.FACTORY_CERT_SUPABASE_URL?.trim() &&
    process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim(),
  );
}

export function resolveFactoryCertificationBackend(): { url: string; anonKey: string } {
  const supabaseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
  const anonKey = process.env.FACTORY_CERT_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_SUPABASE_URL / FACTORY_CERT_SUPABASE_ANON_KEY missing");
  }

  const policy = validateFactoryCertificationBackend({
    supabaseUrl,
    allowRemoteEphemeral: isRemoteEphemeralAllowed(),
    allowedSupabaseHost: process.env.FACTORY_CERT_ALLOWED_SUPABASE_HOST,
    environmentId: process.env.FACTORY_CERT_ENVIRONMENT_ID,
  });
  if (!policy.valid || !policy.normalizedUrl) {
    throw new Error(`UNSAFE_CERTIFICATION_BACKEND: ${policy.reason ?? "backend rejected"}`);
  }
  return { url: policy.normalizedUrl, anonKey };
}

export function readFactoryCertificationCredentials(role: string): FactoryCertificationCredentials | null {
  const spec = factoryCertificationCredentialSpec(role);
  const email = process.env[spec.emailEnv]?.trim();
  const password = process.env[spec.passwordEnv]?.trim();
  if (!email || !password) return null;
  return { role: spec.role, email, password };
}

export function assertNoProvidedCredentialReuse(roles: readonly string[]): void {
  const identities = roles
    .map(readFactoryCertificationCredentials)
    .filter((credential): credential is FactoryCertificationCredentials => Boolean(credential))
    .map(({ role, email }) => ({ role, email }));
  const duplicates = findDuplicateCertificationEmails(identities);
  if (duplicates.length > 0) {
    throw new Error(
      `ROLE_CREDENTIAL_REUSE: ${duplicates.map((d) => `${d.email} => ${d.roles.join("/")}`).join("; ")}`,
    );
  }
}

export function resolveCertificationRole(entry: FactoryRouteEntry): string {
  if (entry.intendedPrimaryAudience.length > 0) return entry.intendedPrimaryAudience[0];

  if (entry.status === "LEGACY_REDIRECT" && entry.legacyRedirectTarget) {
    const target = FACTORY_OPERATIONS_ROUTES.find((candidate) => candidate.route === entry.legacyRedirectTarget);
    if (target?.intendedPrimaryAudience.length) return target.intendedPrimaryAudience[0];
  }

  if (entry.technicallyAllowedRoles.includes("ADMIN")) return "ADMIN";
  if (entry.technicallyAllowedRoles.length > 0) return entry.technicallyAllowedRoles[0];
  throw new Error(`NO_CERTIFICATION_ROLE: ${entry.route} has no technically allowed role`);
}

export function certificationViewports(entry: FactoryRouteEntry): FactoryCertificationViewport[] {
  if (entry.deviceClass === "TV") return [{ name: "tv", width: 1920, height: 1080 }];
  if (entry.deviceClass === "BOTH") {
    return [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
      { name: "tv", width: 1920, height: 1080 },
    ];
  }
  return [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ];
}

export async function loginToFactoryCertificationTarget(
  page: Page,
  credentials: FactoryCertificationCredentials,
): Promise<void> {
  const target = resolveFactoryCertificationTarget();
  await page.goto(`${target}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /Welcome Back/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill(credentials.email);
  await page.getByPlaceholder("••••••••").fill(credentials.password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL((url) => !/\/login(?:\/|$|\?)/i.test(url.pathname), { timeout: 120_000 });
}

type BrowserSessionProof = { accessToken: string; userId: string };

export async function readBrowserSessionProof(page: Page): Promise<BrowserSessionProof> {
  const proof = await page.evaluate(() => {
    type SessionLike = { access_token?: unknown; user?: { id?: unknown } };
    type SearchNode = { value: unknown; depth: number };

    const findSession = (root: unknown): SessionLike | null => {
      const MAX_DEPTH = 12;
      const MAX_NODES = 512;
      const stack: SearchNode[] = [{ value: root, depth: 0 }];
      let visited = 0;

      while (stack.length > 0 && visited < MAX_NODES) {
        const current = stack.pop();
        if (!current) break;
        visited += 1;

        const { value, depth } = current;
        if (!value || typeof value !== "object") continue;

        const candidate = value as SessionLike;
        if (typeof candidate.access_token === "string" && typeof candidate.user?.id === "string") {
          return candidate;
        }
        if (depth >= MAX_DEPTH) continue;

        const children = Array.isArray(value)
          ? value
          : Object.values(value as Record<string, unknown>);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          stack.push({ value: children[index], depth: depth + 1 });
        }
      }
      return null;
    };

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const found = findSession(JSON.parse(raw));
        if (found && typeof found.access_token === "string" && typeof found.user?.id === "string") {
          return { accessToken: found.access_token, userId: found.user.id };
        }
      } catch {
        // Ignore unrelated localStorage values; only a valid Supabase session is accepted.
      }
    }
    return null;
  });

  if (!proof) throw new Error("AUTH_SESSION_MISSING: authenticated Supabase session not found in browser storage");
  return proof;
}

function createCertificationClient(
  backend: { url: string; anonKey: string },
  accessToken: string,
) {
  return createClient<DatabaseWithCanonicalProductionDepartment>(backend.url, backend.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createAuthenticatedCertificationClient(
  page: Page,
): Promise<{ client: ReturnType<typeof createCertificationClient>; session: BrowserSessionProof }> {
  const backend = resolveFactoryCertificationBackend();
  const session = await readBrowserSessionProof(page);
  return { client: createCertificationClient(backend, session.accessToken), session };
}

export async function verifyAuthenticatedRole(page: Page, expectedRole: string): Promise<void> {
  const { client, session } = await createAuthenticatedCertificationClient(page);
  const { data: rows, error } = await client
    .from("users")
    .select("id,role")
    .eq("id", session.userId)
    .limit(1);
  if (error) {
    throw new Error(`BACKEND_READ_FAILED users: ${error.message}`);
  }
  expect(rows, `Authenticated user ${session.userId} must exist in public.users`).toHaveLength(1);
  const actualRole = String(rows?.[0]?.role ?? "").trim().toUpperCase();
  expect(actualRole, `Credential must prove role ${expectedRole}; got ${actualRole || "<empty>"}`).toBe(expectedRole);
}

export async function readAuthoritativeProductionJobs(
  page: Page,
  canonicalDepartment: string,
): Promise<FactoryProductionJobTruth[]> {
  const { client } = await createAuthenticatedCertificationClient(page);
  const { data: rows, error } = await client
    .from("production_jobs")
    .select("id,canonical_department,status,assigned_qty,produced_qty,priority,order_id")
    .eq("canonical_department", canonicalDepartment)
    .in("status", OPEN_PRODUCTION_STATUSES)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`BACKEND_READ_FAILED production_jobs: ${error.message}`);
  }
  return rows ?? [];
}

export function expectedDestinationFor(entry: FactoryRouteEntry): string {
  if (entry.status === "LEGACY_REDIRECT") {
    if (!entry.legacyRedirectTarget) throw new Error(`LEGACY_REDIRECT_MISSING_TARGET: ${entry.route}`);
    return entry.legacyRedirectTarget;
  }
  return entry.route;
}
