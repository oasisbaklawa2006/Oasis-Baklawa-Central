import { defineConfig, devices } from "@playwright/test";
import { validateFactoryCertificationTarget } from "./src/lib/factoryCertificationEnvironmentPolicy";

function resolveFactoryCertificationBaseUrl(): string {
  const targetUrl = process.env.FACTORY_CERT_TARGET_URL?.trim();
  if (!targetUrl) {
    throw new Error("CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL is missing");
  }
  const policy = validateFactoryCertificationTarget({
    targetUrl,
    allowRemoteEphemeral: process.env.FACTORY_CERT_ALLOW_REMOTE_EPHEMERAL === "true",
    allowedHost: process.env.FACTORY_CERT_ALLOWED_HOST,
    environmentId: process.env.FACTORY_CERT_ENVIRONMENT_ID,
  });
  if (!policy.valid || !policy.normalizedUrl) {
    throw new Error(`UNSAFE_CERTIFICATION_TARGET: ${policy.reason ?? "target rejected"}`);
  }
  return policy.normalizedUrl;
}

/**
 * Dedicated Factory Operations certification runner.
 *
 * Credentials are deliberately kept out of Playwright artifacts: trace,
 * screenshots and video are disabled. Full certification is intended for a
 * disposable non-production environment only; tests themselves enforce the
 * target/backend safety policy before authenticating.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /factory-operations-.*\.cert\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "factory-certification-results.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: resolveFactoryCertificationBaseUrl(),
    baseURL: process.env.FACTORY_CERT_TARGET_URL?.trim(),
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "factory-certification-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
