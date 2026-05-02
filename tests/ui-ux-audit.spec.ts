import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.APP_URL || 'https://b2b.oasisbaklawa.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const routes = [
  { name: '01-admin-root', path: '/admin' },
  { name: '02-cmd-war-room', path: '/admin/cmd-war-room' },
  { name: '03-cmd-heartbeat', path: '/admin/heartbeat' },
  { name: '04-order-management', path: '/admin/order-management' },
  { name: '05-production', path: '/admin/production' },
  { name: '06-dispatch', path: '/admin/dispatch-mgmt' },
  { name: '07-finance', path: '/admin/finance' },
  { name: '08-products', path: '/admin/products' },
  { name: '09-customer-home', path: '/home' },
  { name: '10-customer-catalogue', path: '/catalogue' },
  { name: '11-customer-cart', path: '/cart' },
  { name: '12-customer-orders', path: '/orders' },
  { name: '13-customer-dashboard', path: '/dashboard' },
];

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

async function loginAsAdmin(page: Page) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD secret missing.');
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.screenshot({ path: 'test-results/00-login-initial.png' });

  const emailTab = page.getByRole('button', { name: /email/i }).first();
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click();
    await page.waitForTimeout(700);
  }

  const email = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="business" i]').first();
  const password = page.locator('input[type="password"]').first();

  await expect(email).toBeVisible({ timeout: 20000 });
  await email.fill(ADMIN_EMAIL);
  await expect(password).toBeVisible({ timeout: 20000 });
  await password.fill(ADMIN_PASSWORD);

  await page.screenshot({ path: 'test-results/01-login-filled.png' });
  await page.getByRole('button', { name: /login|sign/i }).first().click();
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'test-results/02-after-login.png' });

  if (page.url().includes('/login')) {
    throw new Error('Login failed: still on login page.');
  }
}

async function capturePage(page: Page, name: string, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  console.log(`${name} | ${path} | ${page.url()}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${name}-top.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${name}-mid.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${name}-bottom.png` });
}

test('full visual audit screenshot capture', async ({ page }) => {
  await loginAsAdmin(page);

  for (const route of routes) {
    await capturePage(page, route.name, route.path);
  }
});
