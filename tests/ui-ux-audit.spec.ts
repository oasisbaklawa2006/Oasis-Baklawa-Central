import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://b2b.oasisbaklawa.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const routes = [
  { name: '01-admin-root', path: '/admin', mustSee: /Command Center|Admin Panel|Dashboard/i },
  { name: '02-cmd-war-room', path: '/admin/cmd-war-room', mustSee: /CMD War Room|WhatsApp Lead Verification|Live Battlefield/i },
  { name: '03-cmd-heartbeat', path: '/admin/heartbeat', mustSee: /CMD Heartbeat|Executive Intelligence|Net Revenue/i },
  { name: '04-order-management', path: '/admin/order-management', mustSee: /Order Management|Order ID|Customer/i },
  { name: '05-central-order-pool', path: '/admin/central-pool', mustSee: /Central|Order Pool|Pipeline/i },
  { name: '06-production', path: '/admin/production', mustSee: /Production|Assembly|Factory/i },
  { name: '07-assembly-handheld', path: '/admin/assembly-tasks', mustSee: /Assembly|Task Cards|BOM Demand|Daily Production/i },
  { name: '08-ready-goods-store', path: '/admin/ready-goods', mustSee: /Ready Goods|RGS|Stock/i },
  { name: '09-dispatch-management', path: '/admin/dispatch-mgmt', mustSee: /Dispatch|Packed|Scan/i },
  { name: '10-finance', path: '/admin/finance', mustSee: /Finance|Accounts|Release|Advance|Balance/i },
  { name: '11-clients', path: '/admin/clients', mustSee: /Client|Governance|Applications|Directory/i },
  { name: '12-products', path: '/admin/products', mustSee: /Product|Catalog|Add New Product/i },
  { name: '13-merchandising', path: '/admin/merchandising', mustSee: /Merchandising|Bestsellers|Featured|Sort/i },
  { name: '14-moq-rules', path: '/admin/moq', mustSee: /MOQ|Rules|Carton/i },
  { name: '15-security-gate', path: '/security-gate', mustSee: /Security|Gate|Scan|Carton/i },
  { name: '16-customer-home', path: '/home', mustSee: /Authentic Arabic Sweets|Order Again|Best Sellers|Catalogue/i },
  { name: '17-customer-catalogue', path: '/catalogue', mustSee: /Catalogue|Shop by Category|Search products/i },
  { name: '18-customer-cart', path: '/cart', mustSee: /Cart|Checkout|Order Summary|empty/i },
  { name: '19-customer-orders', path: '/orders', mustSee: /Orders|Order|Track|Status/i },
  { name: '20-customer-dashboard', path: '/dashboard', mustSee: /Dashboard|Growth|Insights|Account/i },
];

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

async function loginAsAdmin(page: Page) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required for authenticated UI audit.');
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  const emailTab = page.getByRole('button', { name: /email/i }).first();
  await expect(emailTab).toBeVisible({ timeout: 20_000 });
  await emailTab.click();

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="business" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await expect(emailInput).toBeVisible({ timeout: 20_000 });
  await emailInput.fill(ADMIN_EMAIL);

  await expect(passwordInput).toBeVisible({ timeout: 20_000 });
  await passwordInput.fill(ADMIN_PASSWORD);

  const loginButton = page.getByRole('button', { name: /login|sign in/i }).first();
  await expect(loginButton).toBeVisible({ timeout: 20_000 });
  await loginButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
  await waitForApp(page);

  if (page.url().includes('/login')) {
    throw new Error('Admin login failed: still on /login. The audit would be a false positive.');
  }
}

async function closeBlockingOverlays(page: Page) {
  const closeButtons = [
    page.getByRole('button', { name: /close/i }).first(),
    page.locator('button:has-text("×")').first(),
    page.locator('button[aria-label*="close" i]').first(),
  ];

  for (const button of closeButtons) {
    try {
      if (await button.isVisible({ timeout: 1000 })) {
        await button.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    } catch {
      // Ignore overlay close failures. Screenshots should still capture the issue.
    }
  }
}

async function captureFullPage(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/ui-ux-audit/${name}.png`,
    fullPage: true,
  });
}

async function auditRoute(page: Page, name: string, path: string, mustSee: RegExp) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  if (page.url().includes('/login')) {
    await captureFullPage(page, `${name}-FAILED-redirected-to-login`);
    throw new Error(`${name} redirected to login. Authentication/session state failed.`);
  }

  await closeBlockingOverlays(page);
  await expect(page.locator('body')).toContainText(mustSee, { timeout: 20_000 });
  await captureFullPage(page, name);
}

test.describe('Oasis B2B UI/UX Visual Audit', () => {
  test('authenticated admin and customer-route screenshot audit', async ({ page }) => {
    await loginAsAdmin(page);

    for (const route of routes) {
      await auditRoute(page, route.name, route.path, route.mustSee);
    }
  });
});
