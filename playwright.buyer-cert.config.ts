import { defineConfig, devices } from "@playwright/test";

/**
 * APP-E2E Tranche 5 Buyer golden-path certification runner.
 * Screenshots are retained as durable evidence; traces stay disabled to avoid
 * credential leakage in artifacts.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /app-e2e-buyer-golden-path\.cert\.spec\.ts/,
  timeout: 300_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "buyer-golden-path-results.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
    video: "off",
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
  },
  projects: [
    { name: "buyer-golden-path-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
