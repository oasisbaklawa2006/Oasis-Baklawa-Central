import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://b2b.oasisbaklawa.com';

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
}

// ---------- SMART LOGIN ----------
async function loginSmart(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await waitForApp(page);

  await page.screenshot({ path: 'test-results/00-login-start.png' });

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

    await page.screenshot({ path: 'test-results/01-login-filled.png' });

    await page.getByRole('button', { name: /login|sign/i }).first().click();
    await page.waitForTimeout(6000);
  }

  await page.screenshot({ path: 'test-results/02-after-login.png' });
}

// ---------- SAFE SCREENSHOT ----------
async function capturePage(page: Page, name: string) {
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

// ---------- MASTER ROUTE LIST ----------
const routes = [
  // ENTRY
  ['/splash', 'splash'],
  ['/intro', 'intro'],
  ['/login', 'login'],
  ['/register', 'register'],
  ['/onboarding', 'onboarding'],
  ['/approval-pending', 'approval'],

  // CLIENT SIDE
  ['/home', 'home'],
  ['/catalogue', 'catalogue'],
  ['/cart', 'cart'],
  ['/orders', 'orders'],
  ['/dashboard', 'dashboard'],
  ['/account', 'account'],
  ['/favorites', 'favorites'],
  ['/documents', 'documents'],

  // ADMIN CORE
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

  // OPERATIONS
  ['/admin/operations', 'operations'],
  ['/admin/assembly', 'assembly'],
  ['/admin/packing-dispatch', 'packing'],
  ['/admin/inventory', 'inventory'],
  ['/admin/logistics', 'logistics'],

  // FINANCE
  ['/admin/accounts-release', 'accounts'],
  ['/admin/finance/payments', 'payments'],
  ['/admin/finance/invoices', 'invoices'],

  // CRM / SALES
  ['/admin/crm', 'crm'],
  ['/admin/sales-hub', 'sales'],
  ['/admin/notifications', 'notifications'],

  // SYSTEM
  ['/admin/settings', 'settings'],
  ['/admin/users', 'users'],
  ['/admin/roles', 'roles'],

  // FALLBACK IMPORTANT
  ['/track', 'tracking'],
  ['/buyer-portal', 'buyer-portal'],
];

test('FULL SYSTEM UI UX AUDIT', async ({ page }) => {
  await loginSmart(page);

  for (const [route, name] of routes) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);

      console.log(`✅ ${name} → ${route}`);

      await capturePage(page, name);
    } catch (err) {
      console.log(`❌ FAILED: ${name}`);
      await page.screenshot({ path: `test-results/${name}-error.png` });
    }
  }
});
