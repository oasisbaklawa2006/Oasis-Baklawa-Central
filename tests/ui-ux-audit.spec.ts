import { test, type Page } from '@playwright/test';

const BASE_URL = process.env.APP_URL || 'https://b2b.oasisbaklawa.com';

test.setTimeout(900000);

/**
 * IMPORTANT:
 * Credentials must come from GitHub Actions secrets:
 *
 * APP_URL
 * ADMIN_EMAIL
 * ADMIN_PASSWORD
 * CUSTOMER_EMAIL
 * CUSTOMER_PASSWORD
 *
 * Do not hardcode passwords inside this file.
 */

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

async function safeName(value: string) {
  return value
    .replace(/\//g, '-')
    .replace(/:/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .toLowerCase();
}

async function captureViewportSet(page: Page, folder: string, name: string) {
  const cleanName = await safeName(name);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `test-results/${folder}/${cleanName}-01-top.png`,
    fullPage: false,
    timeout: 20000,
  });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `test-results/${folder}/${cleanName}-02-mid.png`,
    fullPage: false,
    timeout: 20000,
  });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `test-results/${folder}/${cleanName}-03-bottom.png`,
    fullPage: false,
    timeout: 20000,
  });
}

async function captureCurrent(page: Page, folder: string, name: string) {
  const cleanName = await safeName(name);
  await page.screenshot({
    path: `test-results/${folder}/${cleanName}.png`,
    fullPage: false,
    timeout: 20000,
  });
}

async function tryClickAndCapture(
  page: Page,
  folder: string,
  label: string,
  locatorText: RegExp | string
) {
  try {
    const button =
      typeof locatorText === 'string'
        ? page.getByText(locatorText, { exact: false }).first()
        : page.getByText(locatorText).first();

    if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
      await button.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      await captureCurrent(page, folder, `popup-${label}`);
      await closePossiblePopup(page);
    }
  } catch {
    console.log(`Popup/action not available: ${label}`);
  }
}

async function closePossiblePopup(page: Page) {
  const closeSelectors = [
    'button[aria-label*="close" i]',
    'button:has-text("Close")',
    'button:has-text("Cancel")',
    'button:has-text("×")',
    '[role="dialog"] button',
  ];

  for (const selector of closeSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // continue
    }
  }

  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch {
    // ignore
  }
}

async function loginWithEmail(page: Page, emailValue?: string, passwordValue?: string, label = 'user') {
  if (!emailValue || !passwordValue) {
    throw new Error(`${label} login secrets missing.`);
  }

  await page.goto(`${BASE_URL}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  await waitForApp(page);
  await captureCurrent(page, '00-Auth', `${label}-login-start`);

  const emailTab = page.getByRole('button', { name: /email/i }).first();

  if (await emailTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailTab.click();
    await page.waitForTimeout(1000);
  }

  await captureCurrent(page, '00-Auth', `${label}-email-tab`);

  const emailInput = page
    .locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="business" i]')
    .first();

  const passwordInput = page.locator('input[type="password"]').first();

  if (!(await emailInput.isVisible({ timeout: 15000 }).catch(() => false))) {
    await captureCurrent(page, '00-Auth', `${label}-email-input-not-found`);
    throw new Error(`${label} email input not found.`);
  }

  if (!(await passwordInput.isVisible({ timeout: 15000 }).catch(() => false))) {
    await captureCurrent(page, '00-Auth', `${label}-password-input-not-found`);
    throw new Error(`${label} password input not found.`);
  }

  await emailInput.fill(emailValue);
  await passwordInput.fill(passwordValue);

  await captureCurrent(page, '00-Auth', `${label}-login-filled`);

  const submit = page.getByRole('button', { name: /login|sign in|continue/i }).first();
  await submit.click({ timeout: 10000 });

  await page.waitForTimeout(6000);
  await captureCurrent(page, '00-Auth', `${label}-after-login`);

  if (page.url().includes('/login')) {
    await captureCurrent(page, '00-Auth', `${label}-still-on-login`);
    throw new Error(`${label} login failed.`);
  }
}

type AuditRoute = {
  folder: string;
  name: string;
  path: string;
  actions?: Array<{
    label: string;
    text: RegExp | string;
  }>;
};

async function auditRoute(page: Page, route: AuditRoute) {
  try {
    if (page.isClosed()) {
      console.log(`SKIPPED: ${route.name}, page closed`);
      return;
    }

    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await waitForApp(page);

    console.log(`OK: ${route.folder} / ${route.name} -> ${route.path} -> ${page.url()}`);

    await captureViewportSet(page, route.folder, route.name);

    if (route.actions?.length) {
      for (const action of route.actions) {
        await tryClickAndCapture(page, route.folder, `${route.name}-${action.label}`, action.text);
      }
    }
  } catch (err) {
    console.log(`FAILED: ${route.folder} / ${route.name} -> ${route.path}`);
    console.log(err instanceof Error ? err.message : String(err));

    try {
      if (!page.isClosed()) {
        await captureCurrent(page, route.folder, `${route.name}-error`);
      }
    } catch {
      console.log(`Could not capture error screenshot for ${route.name}`);
    }
  }
}

/**
 * Public / entry pages do not need login.
 */
const publicRoutes: AuditRoute[] = [
  { folder: '01-Public-Entry', name: 'Splash', path: '/splash' },
  { folder: '01-Public-Entry', name: 'Company-Intro', path: '/intro' },
  {
    folder: '01-Public-Entry',
    name: 'Login',
    path: '/login',
    actions: [
      { label: 'Email-Tab', text: /email/i },
      { label: 'Mobile-Tab', text: /mobile|otp|phone/i },
      { label: 'B2B-Access', text: /apply|b2b|register/i },
    ],
  },
  { folder: '01-Public-Entry', name: 'Register', path: '/register' },
  { folder: '01-Public-Entry', name: 'Onboarding', path: '/onboarding' },
  { folder: '01-Public-Entry', name: 'Reset-Password', path: '/reset-password' },
  { folder: '01-Public-Entry', name: 'Approval-Pending', path: '/approval-pending' },
  { folder: '01-Public-Entry', name: 'Public-Tracking', path: '/track' },
  { folder: '01-Public-Entry', name: 'Terms', path: '/terms' },
  { folder: '01-Public-Entry', name: 'Privacy', path: '/privacy' },
  { folder: '01-Public-Entry', name: 'Shipping', path: '/shipping' },
];

/**
 * Buyer / customer side.
 * This should run with CUSTOMER_EMAIL + CUSTOMER_PASSWORD.
 */
const buyerRoutes: AuditRoute[] = [
  {
    folder: '02-Buyer-Homepage',
    name: 'Home',
    path: '/home',
    actions: [
      { label: 'Explore-Catalogue', text: /catalogue|explore/i },
      { label: 'Reorder', text: /reorder|repeat/i },
      { label: 'Resume-Cart', text: /cart|continue/i },
    ],
  },
  {
    folder: '03-Buyer-Catalogue',
    name: 'Catalogue',
    path: '/catalogue',
    actions: [
      { label: 'Search', text: /search/i },
      { label: 'Add-Product', text: /add/i },
      { label: 'Category', text: /baklawa|dates|chocolate|nuts|gift/i },
    ],
  },
  {
    folder: '04-Franchisee-Quick-Order',
    name: 'Quick-Order-Matrix',
    path: '/quick-order',
    actions: [
      { label: 'Add-Quantity', text: /\+/ },
      { label: 'View-Cart', text: /cart|review/i },
    ],
  },
  {
    folder: '05-Buyer-Cart',
    name: 'Cart',
    path: '/cart',
    actions: [
      { label: 'Checkout', text: /checkout|proceed/i },
      { label: 'Clear-Cart', text: /clear|remove/i },
    ],
  },
  {
    folder: '06-Buyer-Orders',
    name: 'Orders',
    path: '/orders',
    actions: [
      { label: 'Track-Order', text: /track|view/i },
      { label: 'Download', text: /download|invoice|so/i },
    ],
  },
  {
    folder: '06-Buyer-Orders',
    name: 'Order-Tracking-Sample',
    path: '/orders/sample',
  },
  {
    folder: '07-Buyer-Dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    actions: [
      { label: 'Growth-Panel', text: /growth|insight/i },
      { label: 'Pending-Payment', text: /payment|pending/i },
    ],
  },
  { folder: '08-Buyer-Account', name: 'My-Account', path: '/account' },
  { folder: '08-Buyer-Account', name: 'Account-Users', path: '/account/users' },
  { folder: '08-Buyer-Account', name: 'Account-Addresses', path: '/account/addresses' },
  { folder: '08-Buyer-Account', name: 'Account-Logistics', path: '/account/logistics' },
  { folder: '09-Buyer-Tools', name: 'Favorites', path: '/favorites' },
  { folder: '09-Buyer-Tools', name: 'Documents', path: '/documents' },
  { folder: '09-Buyer-Tools', name: 'Buyer-Portal', path: '/buyer-portal' },
  { folder: '09-Buyer-Tools', name: 'FAQ', path: '/faq' },
];

/**
 * Admin/staff side.
 * This should run with ADMIN_EMAIL + ADMIN_PASSWORD.
 */
const adminRoutes: AuditRoute[] = [
  {
    folder: '10-Admin-Dashboard',
    name: 'Unified-Dashboard',
    path: '/admin',
    actions: [
      { label: 'Notifications', text: /notification|alert/i },
      { label: 'Order-Link', text: /order/i },
    ],
  },
  {
    folder: '11-War-Room',
    name: 'CMD-War-Room',
    path: '/admin/cmd-war-room',
    actions: [
      { label: 'Order-Triage', text: /triage|verify|edit/i },
      { label: 'Aliases', text: /alias/i },
      { label: 'Refresh', text: /refresh/i },
    ],
  },
  {
    folder: '10-Admin-Dashboard',
    name: 'Heartbeat-Merged-Dashboard',
    path: '/admin/heartbeat',
  },
  {
    folder: '12-Display-Management',
    name: 'Display-Management',
    path: '/admin/display-management',
    actions: [
      { label: 'TV-Link', text: /tv|display/i },
      { label: 'Factory-Display', text: /factory|production/i },
    ],
  },
  {
    folder: '13-Order-System',
    name: 'Order-Management',
    path: '/admin/order-management',
    actions: [
      { label: 'Open-Order', text: /view|details|order/i },
      { label: 'Filter', text: /filter|status/i },
    ],
  },
  { folder: '13-Order-System', name: 'Central-Order-Pool', path: '/admin/central-pool' },
  { folder: '13-Order-System', name: 'Legacy-Admin-Orders', path: '/admin/orders' },

  {
    folder: '14-Operations',
    name: 'Operations',
    path: '/admin/operations',
    actions: [
      { label: 'Assign', text: /assign|route/i },
      { label: 'Priority', text: /priority|urgent/i },
    ],
  },
  {
    folder: '15-Production-Center',
    name: 'Production-Control-Center',
    path: '/admin/production',
    actions: [
      { label: 'Start-Production', text: /start|begin/i },
      { label: 'Mark-Complete', text: /complete|ready/i },
    ],
  },
  {
    folder: '16-Assembly',
    name: 'Assembly-Tasks',
    path: '/admin/assembly-tasks',
    actions: [
      { label: 'Mark-Ready', text: /ready|complete/i },
      { label: 'Request-Material', text: /request|material/i },
    ],
  },
  { folder: '16-Assembly', name: 'Assembly-TV', path: '/admin/assembly-tv' },

  {
    folder: '17-Ready-Goods',
    name: 'Ready-Goods-Store',
    path: '/admin/ready-goods',
    actions: [
      { label: 'Stock', text: /stock|inventory/i },
      { label: 'Barcode', text: /barcode|scan/i },
    ],
  },
  { folder: '17-Ready-Goods', name: 'RGS-TV', path: '/admin/rgs-tv' },
  { folder: '18-Third-Party-Store', name: 'Third-Party-Store', path: '/admin/3pcs-store' },

  {
    folder: '19-Packing-Dispatch',
    name: 'Packing-Dispatch',
    path: '/admin/packing-dispatch',
    actions: [
      { label: 'Packing', text: /pack|packing/i },
      { label: 'DPL', text: /dpl|packing list/i },
    ],
  },
  {
    folder: '19-Packing-Dispatch',
    name: 'Dispatch-Management',
    path: '/admin/dispatch-mgmt',
    actions: [
      { label: 'LR-AWB', text: /lr|awb|waybill|tracking/i },
      { label: 'Dispatched', text: /dispatch|delivered/i },
    ],
  },
  { folder: '19-Packing-Dispatch', name: 'Dispatch-TV', path: '/admin/dispatch-tv' },

  {
    folder: '20-Finance',
    name: 'Finance',
    path: '/admin/finance',
    actions: [
      { label: 'Payment-Approval', text: /approve|verify|release/i },
      { label: 'Invoice', text: /invoice|pi|proforma/i },
    ],
  },
  { folder: '20-Finance', name: 'Accounts-Release', path: '/admin/accounts-release' },
  { folder: '20-Finance', name: 'Pricing', path: '/admin/pricing' },

  {
    folder: '21-Inventory-Logistics',
    name: 'Inventory',
    path: '/admin/inventory',
    actions: [
      { label: 'Stock', text: /stock/i },
      { label: 'Barcode', text: /barcode/i },
    ],
  },
  {
    folder: '21-Inventory-Logistics',
    name: 'Logistics',
    path: '/admin/logistics',
    actions: [
      { label: 'Transporter', text: /transport|logistics/i },
      { label: 'Tracking', text: /tracking|awb|lr/i },
    ],
  },

  {
    folder: '22-Clients-Governance',
    name: 'Clients',
    path: '/admin/clients',
    actions: [
      { label: 'Approve-Client', text: /approve|application/i },
      { label: 'View-Client', text: /view|details/i },
    ],
  },
  { folder: '22-Clients-Governance', name: 'Approvals', path: '/admin/approvals' },
  { folder: '22-Clients-Governance', name: 'Users', path: '/admin/users' },
  { folder: '22-Clients-Governance', name: 'Audit-Trail', path: '/admin/audit' },

  {
    folder: '23-Product-Merchandising',
    name: 'Products',
    path: '/admin/products',
    actions: [
      { label: 'Add-Product', text: /add|create|new/i },
      { label: 'Edit-Product', text: /edit/i },
    ],
  },
  { folder: '23-Product-Merchandising', name: 'Merchandising', path: '/admin/merchandising' },
  { folder: '23-Product-Merchandising', name: 'MOQ-Rules', path: '/admin/moq' },
  { folder: '23-Product-Merchandising', name: 'Currency', path: '/admin/currency' },

  { folder: '24-Sales-Support', name: 'Sales-Hub', path: '/admin/sales-hub' },
  { folder: '24-Sales-Support', name: 'Sales-Dashboard', path: '/sales/dashboard' },
  { folder: '24-Sales-Support', name: 'Support', path: '/admin/support' },
  { folder: '24-Sales-Support', name: 'Notifications', path: '/admin/notifications' },
  { folder: '24-Sales-Support', name: 'Announcements', path: '/admin/announcements' },

  { folder: '25-System-Settings', name: 'Settings', path: '/admin/settings' },
  { folder: '25-System-Settings', name: 'Department', path: '/admin/department' },
  { folder: '25-System-Settings', name: 'Exceptions', path: '/admin/exceptions' },
  { folder: '25-System-Settings', name: 'Verification-War-Room', path: '/admin/verification' },
  { folder: '25-System-Settings', name: 'Target-vs-Actual', path: '/admin/target-vs-actual' },
];

/**
 * Device / TV routes.
 * These are kept separate because they are operational display endpoints.
 */
const tvRoutes: AuditRoute[] = [
  { folder: '26-TV-Displays', name: 'TV-Arabic-Sweets', path: '/tv/arabic-sweets' },
  { folder: '26-TV-Displays', name: 'TV-Chocolate', path: '/tv/chocolate' },
  { folder: '26-TV-Displays', name: 'TV-Dragees', path: '/tv/dragees' },
  { folder: '26-TV-Displays', name: 'TV-Fusion', path: '/tv/fusion' },
  { folder: '26-TV-Displays', name: 'TV-Bakery', path: '/tv/bakery' },
  { folder: '26-TV-Displays', name: 'TV-Nuts', path: '/tv/nuts' },
];

/**
 * Full flow smoke check.
 * This captures the actual intended app journeys.
 */
const flowRoutes: AuditRoute[] = [
  { folder: '27-App-Flows', name: 'Flow-Entry-Login', path: '/login' },
  { folder: '27-App-Flows', name: 'Flow-Buyer-Home', path: '/home' },
  { folder: '27-App-Flows', name: 'Flow-Quick-Order', path: '/quick-order' },
  { folder: '27-App-Flows', name: 'Flow-Cart', path: '/cart' },
  { folder: '27-App-Flows', name: 'Flow-Orders', path: '/orders' },
  { folder: '27-App-Flows', name: 'Flow-Admin-Dashboard', path: '/admin' },
  { folder: '27-App-Flows', name: 'Flow-War-Room', path: '/admin/cmd-war-room' },
  { folder: '27-App-Flows', name: 'Flow-Production', path: '/admin/production' },
  { folder: '27-App-Flows', name: 'Flow-Dispatch', path: '/admin/dispatch-mgmt' },
];

test('Public Entry UI Audit', async ({ page }) => {
  for (const route of publicRoutes) {
    await auditRoute(page, route);
  }
});

test('Buyer UI Audit', async ({ page }) => {
  await loginWithEmail(page, process.env.CUSTOMER_EMAIL, process.env.CUSTOMER_PASSWORD, 'buyer');

  for (const route of buyerRoutes) {
    await auditRoute(page, route);
  }
});

test('Admin UI Audit', async ({ page }) => {
  await loginWithEmail(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, 'admin');

  for (const route of adminRoutes) {
    await auditRoute(page, route);
  }
});

test('TV Display Audit', async ({ page }) => {
  await loginWithEmail(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, 'admin-tv');

  for (const route of tvRoutes) {
    await auditRoute(page, route);
  }
});

test('Core Flow Audit', async ({ page }) => {
  await loginWithEmail(page, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, 'flow-admin');

  for (const route of flowRoutes) {
    await auditRoute(page, route);
  }
});
