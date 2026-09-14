import { defineConfig, devices } from "@playwright/test";

/**
 * Point100 cross-lifecycle dress rehearsal runner.
 *
 * Composes factory certification disposable backend with lifecycle orchestration,
 * capability matrix generation, and negative-path injection. Credentials stay out
 * of Playwright artifacts (trace/screenshot/video disabled).
 */
export default defineConfig({
  testDir: "./tests/point100",
  testMatch: /.*\.cert\.spec\.ts/,
  timeout: 300_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "point100-certification-results.json" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: "point100-certification-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
