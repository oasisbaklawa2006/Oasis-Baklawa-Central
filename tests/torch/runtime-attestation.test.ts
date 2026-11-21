import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import attestation from "../../api/runtime-attestation";

const root = process.cwd();
const manifestPath = path.join(root, "server-only/torch-attestation.manifest.json");
const token = "test-runtime-attestation-token";
const manifest = {
  app: "central",
  gitSha: "a".repeat(40),
  environment: "preview",
  supabaseProjectRef: "abcdefghijklmnopqrst",
  activeFeatureFlags: { isRealtimeEnabled: false },
  demoMode: false,
};
const envKeys = [
  "TORCH_ATTEST_TOKEN",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VITE_DEMO_MODE",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalManifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;

function writeManifest(value: unknown): void {
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(value));
}

function buildSpa(output: string): void {
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "build",
      "--config",
      path.join(root, "vite.config.ts"),
      "--mode",
      "production",
      "--outDir",
      output,
      "--logLevel",
      "silent",
    ],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
}

async function request(method = "GET", providedToken?: string): Promise<Response> {
  const headers = providedToken === undefined ? {} : { "X-Torch-Attest-Token": providedToken };
  const response = await attestation.fetch(new Request("http://localhost/api/runtime-attestation", { method, headers }));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return response;
}

describe("WO-TB-02 runtime attestation", () => {
  beforeAll(() => {
    process.env.TORCH_ATTEST_TOKEN = token;
  });

  beforeEach(() => {
    writeManifest(manifest);
    process.env.TORCH_ATTEST_TOKEN = token;
  });

  afterAll(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    if (originalManifest === null) {
      rmSync(manifestPath, { force: true });
      try {
        rmSync(path.dirname(manifestPath));
      } catch {
        // Keep any other ignored server-only artifacts intact.
      }
    } else {
      writeFileSync(manifestPath, originalManifest);
    }
  });

  it("denies missing and invalid tokens without metadata and rejects non-GET methods", async () => {
    for (const [response, status] of [
      [await request(), 401],
      [await request("GET", "wrong-token"), 401],
      [await request("POST", token), 405],
    ] as const) {
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("");
    }
  });

  it("returns exactly the six contract keys and no secrets for a valid live manifest", async () => {
    const response = await request("GET", token);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["app", "gitSha", "environment", "supabaseProjectRef", "activeFeatureFlags", "demoMode"].sort(),
    );
    expect(body).toEqual(manifest);
    expect(JSON.stringify(body)).not.toContain(token);
    expect(Object.keys(body.activeFeatureFlags)).toEqual(["isRealtimeEnabled"]);
  });

  it("builds a demo manifest with a null project ref and serves it", async () => {
    const output = path.join(os.tmpdir(), `torch-attestation-demo-${process.pid}`);
    rmSync(output, { recursive: true, force: true });
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_SHA = "c".repeat(40);
    process.env.VITE_DEMO_MODE = "true";

    try {
      buildSpa(output);

      const response = await request("GET", token);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.supabaseProjectRef).toBeNull();
      expect(body.demoMode).toBe(true);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  }, 60_000);

  it("fails closed with no metadata for missing or corrupt manifests and invalid config", async () => {
    for (const invalid of [null, "{", { ...manifest, unexpected: "metadata" }]) {
      if (invalid === null) rmSync(manifestPath, { force: true });
      else if (typeof invalid === "string") writeFileSync(manifestPath, invalid);
      else writeManifest(invalid);

      const response = await request("GET", token);
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("");
    }
  });

  it("serves build-baked SPA values despite changed Function runtime env and keeps the manifest out of static assets", async () => {
    const output = path.join(os.tmpdir(), `torch-attestation-${process.pid}`);
    rmSync(output, { recursive: true, force: true });
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_SHA = "b".repeat(40);
    process.env.VITE_DEMO_MODE = "false";
    process.env.VITE_SUPABASE_PROJECT_ID = "abcdefghijklmnopqrst";
    process.env.VITE_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";

    try {
      buildSpa(output);

      process.env.VITE_SUPABASE_PROJECT_ID = "zyxwvutsrqponmlkjihg";
      process.env.VITE_SUPABASE_URL = "https://zyxwvutsrqponmlkjihg.supabase.co";
      process.env.VITE_DEMO_MODE = "true";

      const response = await request("GET", token);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.supabaseProjectRef).toBe("abcdefghijklmnopqrst");
      expect(body.activeFeatureFlags).toEqual(manifest.activeFeatureFlags);
      expect(body.demoMode).toBe(false);
      expect(body.gitSha).toBe("b".repeat(40));

      expect(existsSync(path.join(output, "server-only/torch-attestation.manifest.json"))).toBe(false);
      expect(existsSync(path.join(root, "dist/server-only/torch-attestation.manifest.json"))).toBe(false);
      expect(existsSync(path.join(root, "public/torch-attestation.manifest.json"))).toBe(false);
      expect(existsSync(path.join(root, "public/server-only/torch-attestation.manifest.json"))).toBe(false);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  }, 60_000);
});
