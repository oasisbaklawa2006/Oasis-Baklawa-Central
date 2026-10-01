import { defineConfig, devices } from "@playwright/test";

/** Must match governed disposable preview bind in factory-certification-ephemeral.yml */
const DISPOSABLE_CERT_BASE_URL = "http://127.0.0.1:4173";

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
    baseURL: DISPOSABLE_CERT_BASE_URL,
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
