import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://b2b.oasisbaklawa.com';

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
}

async function loginSmart(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
  await page.screenshot({ path: 'test-results/00-login-start.png' });

  const emailTab = page.getByRole('button', { name: /email/i }).first();
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click();
    await page.waitForTimeout(1000);
  }

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="business" i]').first();
  const passInput = page.locator('input[type="password"]').first();

  if ((await emailInput.count()) > 0 && (await passInput.count()) > 0) {
    await emailInput.fill(process.env.ADMIN_EMAIL || '');
    await passInput.fill(process.env.ADMIN_PASSWORD || '');
    await page.screenshot({ path: 'test-results/01-login-filled.png' });
    await page.getByRole('button', { name: /login|sign/i }).first().click();
    await page.waitForTimeout(6000);
  } else {
    await page.screenshot({ path: 'test-results/01-email-login-not-found.png' });
  }

  await page.screenshot({ path: 'test-results/02-after-login-attempt.png' });
}

async function safeScreenshots(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/${name}-top.png`, fullPage: false });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/${name}-mid.png`, fullPage: false });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/${name}-bottom.png`, fullPage: false });
}

test('UI UX screenshot audit', async ({ page }) => {
  await loginSmart(page);

  const routes = [
    ['admin-root', '/admin'],
    ['cmd-war-room', '/admin/cmd-war-room'],
    ['cmd-heartbeat', '/admin/heartbeat'],
    ['order-management', '/admin/order-management'],
    ['production', '/admin/production'],
    ['dispatch', '/admin/dispatch-mgmt'],
    ['finance', '/admin/finance'],
    ['products', '/admin/products'],
    ['home', '/home'],
    ['catalogue', '/catalogue'],
    ['cart', '/cart'],
    ['orders', '/orders'],
    ['dashboard', '/dashboard'],
  ] as const;

  for (const [name, route] of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await safeScreenshots(page, name);
  }
});
