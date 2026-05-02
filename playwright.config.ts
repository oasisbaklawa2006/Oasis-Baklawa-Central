import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.APP_URL || 'https://b2b.oasisbaklawa.com',
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    actionTimeout: 15000,
    navigationTimeout: 45000,
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
