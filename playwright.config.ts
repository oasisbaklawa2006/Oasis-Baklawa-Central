import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.APP_URL || process.env.BASE_URL || 'https://b2b.oasisbaklawa.com',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'mobile-safari-size',
      use: {
        ...devices['iPhone 14 Pro'],
      },
    },
    {
      name: 'desktop-chrome-size',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1200 },
      },
    },
  ],
});
