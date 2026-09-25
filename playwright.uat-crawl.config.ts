import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.UAT_CRAWL_BASE_URL ||
  process.env.APP_URL ||
  "https://oasis-baklawa-centra-git-b9f168-oasisbaklawa2006-6222s-projects.vercel.app";

export default defineConfig({
  testDir: "./tests/uat-crawl",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "uat-evidence/playwright-output",
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
