import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://b2b.oasisbaklawa.com';

test.setTimeout(600000);

// -------------------- UTIL --------------------

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

// -------------------- LOGIN --------------------

async function loginSmart(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
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

// -------------------- SCREENSHOT ENGINE --------------------

async function capturePage(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${name}-top.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/${name}-mid.png` });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/${name}-bottom.png` });
}

// -------------------- ROUTES --------------------

const routes = [

  // ---------- PUBLIC / ENTRY ----------
  ['/splash', 'splash'],
  ['/intro', 'intro'],
  ['/login', 'login'],
  ['/register', 'register'],
  ['/onboarding', 'onboarding'],
  ['/approval-pending', 'approval'],

  // ---------- CUSTOMER ----------
  ['/home', 'home'],
  ['/catalogue', 'catalogue'],
  ['/quick-order', 'quick-order'], // NEW
  ['/cart', 'cart'],
  ['/orders', 'orders'],
  ['/dashboard', 'dashboard'],
  ['/account', 'account'],
  ['/favorites', 'favorites'],
  ['/documents', 'documents'],
  ['/buyer-portal', 'buyer-portal'],
  ['/track', 'public-tracking'], // NEW

  // ---------- ADMIN CORE ----------
  ['/admin', 'admin-root'],
  ['/admin/cmd-war-room', 'cmd-war-room'],
  ['/admin/heartbeat', 'heartbeat-merged-dashboard'], // merged
  ['/admin/display-management', 'display-management'], // NEW

  // ---------- ORDER SYSTEM ----------
  ['/admin/order-management', 'order-management'],
  ['/admin/central-pool', 'central-pool'],

  // ---------- OPERATIONS ----------
  ['/admin/operations', 'operations'],
  ['/admin/production', 'production-center'], // UPDATED
  ['/admin/assembly-tasks', 'assembly'],
  ['/admin/packing-dispatch', 'packing'],
  ['/admin/dispatch-mgmt', 'dispatch'],

  // ---------- INVENTORY ----------
  ['/admin/inventory', 'inventory'],
  ['/admin/ready-goods', 'ready-goods'],
  ['/admin/3pcs-store', 'third-party-store'],

  // ---------- FINANCE ----------
  ['/admin/finance', 'finance'],
  ['/admin/accounts-release', 'accounts-release'],

  // ---------- SUPPORT SYSTEM ----------
  ['/admin/notifications', 'notifications'],
  ['/admin/support', 'support'],

  // ---------- CONFIG ----------
  ['/admin/products', 'products'],
  ['/admin/pricing', 'pricing'],
  ['/admin/users', 'users'],
  ['/admin/settings', 'settings'],
  ['/admin/logistics', 'logistics'], // CRITICAL

];

// -------------------- MAIN TEST --------------------

test('Oasis 2.0 FULL UI UX AUDIT', async ({ page }) => {

  await loginSmart(page);

  for (const [route, name] of routes) {
    try {

      if (page.isClosed()) {
        console.log(`SKIPPED: ${name}`);
        continue;
      }

      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      await waitForApp(page);

      console.log(`OK: ${name}`);
      await capturePage(page, name);

    } catch (err) {

      console.log(`FAILED: ${name}`);

      try {
        if (!page.isClosed()) {
          await page.screenshot({
            path: `test-results/${name}-error.png`,
          });
        }
      } catch {}

      continue;
    }
  }
});
