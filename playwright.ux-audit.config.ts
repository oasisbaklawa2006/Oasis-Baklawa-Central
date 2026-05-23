import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.APP_URL ||
  process.env.BASE_URL ||
  'https://cursor-central-vercel.vercel.app';

/**
 * Dedicated Playwright config for mobile-first UX audit (four viewports).
 * Run: npm run test:ux-audit
 * Default repo config (playwright.config.ts) keeps CI / legacy project names.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/ux-audit.spec.ts',
  timeout: 2_400_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'audit-artifacts/playwright-output',
  reporter: [
    ['html', { outputFolder: 'audit-artifacts/html-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'audit-artifacts/playwright-report.json' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'on',
    screenshot: 'off',
    video: 'on',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'iphone-14-pro',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad Pro 11'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
