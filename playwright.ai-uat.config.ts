import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ai-uat",
  testMatch: "**/*.spec.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results/ai-uat-playwright",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/ai-uat-playwright-report.json" }],
  ],
  use: {
    browserName: "chromium",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
});
