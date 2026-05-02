import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.APP_URL || 'https://b2b.oasisbaklawa.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const routes = [
  { name: '01-admin-root', path: '/admin', mustSee: /Command Center|Admin Panel|Dashboard/i },
  { name: '02-cmd-war-room', path: '/admin/cmd-war-room', mustSee: /CMD War Room|WhatsApp Lead Verification/i },
  { name: '03-cmd-heartbeat', path: '/admin/heartbeat', mustSee: /CMD Heartbeat|Executive Intelligence/i },
  { name: '04-order-management', path: '/admin/order-management', mustSee: /Order Management/i },
  { name: '05-production', path: '/admin/production', mustSee: /Production|Assembly/i },
  { name: '06-dispatch', path: '/admin/dispatch-mgmt', mustSee: /Dispatch/i },
  { name: '07-finance', path: '/admin/finance', mustSee: /Finance/i },
  { name: '08-products', path: '/admin/products', mustSee: /Product|Catalog/i },
  { name: '09-customer-home', path: '/home', mustSee: /Authentic Arabic Sweets|Best Sellers/i },
  { name: '10-customer-catalogue', path: '/catalogue', mustSee: /Catalogue|Shop by Category/i },
];

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await waitForApp(page);
  await page.screenshot({ path: 'test-results/00-login-initial.png' });

  const emailTab = page.getByRole('button', { name: /email/i }).first();
  await expect(emailTab).toBeVisible({ timeout: 15000 });
  await emailTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/00-login-email-tab.png' });

  const email = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="business" i]').first();
  const password = page.locator('input[type="password"]').first();

  await expect(email).toBeVisible({ timeout: 15000 });
  await email.fill(ADMIN_EMAIL || '');

  await expect(password).toBeVisible({ timeout: 15000 });
  await password.fill(ADMIN_PASSWORD || '');

  await page.getByRole('button', { name: /login|sign/i }).first().click();
  await page.waitForTimeout(4000);

  if (page.url().includes('/login')) {
    await page.screenshot({ path: 'test-results/00-login-failed-still-on-login.png' });
    throw new Error('Login failed: still on login page after email/password submit.');
  }
}

async function captureViewportShots(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${name}-top.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${name}-mid.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${name}-bottom.png` });
}

async function auditRoute(page: Page, name: string, path: string, mustSee: RegExp) {
  await page.goto(`${BASE_URL}${path}`);
  await waitForApp(page);

  if (page.url().includes('/login')) {
    await page.screenshot({ path: `test-results/${name}-redirected-to-login.png` });
    throw new Error(`${name} redirected to login.`);
  }

  await expect(page.locator('body')).toContainText(mustSee, { timeout: 15000 });
  await captureViewportShots(page, name);
}

test('UI UX audit fixed', async ({ page }) => {
  await loginAsAdmin(page);

  for (const route of routes) {
    await auditRoute(page, route.name, route.path, route.mustSee);
  }
});
