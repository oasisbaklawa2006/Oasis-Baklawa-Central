import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://b2b.oasisbaklawa.com';

test.setTimeout(600000);

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

async function loginSmart(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForApp(page);

  await page.screenshot({ path: 'test-results/00-login-start.png', fullPage: false });

  const emailTab = page.getByRole('button', { name: /email/i }).first();
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click();
    await page.waitForTimeout(1000);
  }

  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();

  if ((await email.count()) > 0 && (await password.count()) > 0) {
    await email.fill(process.env.ADMIN_EMAIL || '');
    await password.fill(process.env.ADMIN_PASSWORD || '');
    await page.screenshot({ path: 'test-results/01-login-filled.png', fullPage: false });
    await page.getByRole('button', { name: /login|sign/i }).first().click();
    await page.waitForTimeout(6000);
  }

  await page.screenshot({ path: 'test-results/02-after-login.png', fullPage: false });
}

async function capturePage(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${name}-top.png`, fullPage: false, timeout: 20000 });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${name}-mid.png`, fullPage: false, timeout: 20000 });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${name}-bottom.png`, fullPage: false, timeout: 20000 });
}

const routes = [
  ['/splash', 'splash'],
  ['/intro', 'intro'],
  ['/login', 'login'],
  ['/register', 'register'],
  ['/onboarding', 'onboarding'],
  ['/approval-pending', 'approval'],
  ['/home', 'home'],
  ['/catalogue', 'catalogue'],
  ['/cart', 'cart'],
  ['/orders', 'orders'],
  ['/dashboard', 'dashboard'],
  ['/account', 'account'],
  ['/favorites', 'favorites'],
  ['/documents', 'documents'],
  ['/admin', 'admin-root'],
  ['/admin/cmd-war-room', 'cmd-war-room'],
  ['/admin/heartbeat', 'heartbeat'],
  ['/admin/order-management', 'order-mgmt'],
  ['/admin/production', 'production'],
  ['/admin/dispatch-mgmt', 'dispatch'],
  ['/admin/finance', 'finance'],
  ['/admin/products', 'products'],
  ['/admin/customers', 'customers'],
  ['/admin/approvals', 'approvals'],
  ['/admin/operations', 'operations'],
  ['/admin/assembly', 'assembly'],
  ['/admin/packing-dispatch', 'packing'],
  ['/admin/inventory', 'inventory'],
  ['/admin/logistics', 'logistics'],
  ['/admin/accounts-release', 'accounts'],
  ['/admin/finance/payments', 'payments'],
  ['/admin/finance/invoices', 'invoices'],
  ['/admin/crm', 'crm'],
  ['/admin/sales-hub', 'sales'],
  ['/admin/notifications', 'notifications'],
  ['/admin/settings', 'settings'],
  ['/admin/users', 'users'],
  ['/admin/roles', 'roles'],
  ['/track', 'tracking'],
  ['/buyer-portal', 'buyer-portal'],
] as const;

test('FULL SYSTEM UI UX AUDIT', async ({ page }) => {
  await loginSmart(page);

  for (const [route, name] of routes) {
    try {
      if (page.isClosed()) {
        console.log(`SKIPPED: ${name} because page was closed`);
        continue;
      }

      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await waitForApp(page);
      console.log(`OK: ${name} -> ${route} -> ${page.url()}`);
      await capturePage(page, name);
    } catch (err) {
      console.log(`FAILED: ${name} -> ${route}`);
      console.log(err instanceof Error ? err.message : String(err));
      try {
        if (!page.isClosed()) {
          await page.screenshot({ path: `test-results/${name}-error.png`, fullPage: false, timeout: 10000 });
        }
      } catch {
        console.log(`Could not capture error screenshot for ${name}`);
      }
      continue;
    }
  }
});
