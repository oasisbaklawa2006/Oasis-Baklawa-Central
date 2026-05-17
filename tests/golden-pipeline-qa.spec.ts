import { test, expect, type Page } from '@playwright/test';

const PREVIEW_URL = process.env.TEST_PREVIEW_URL || 'http://localhost:3000';

async function login(page: Page, email: string, password: string) {
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Sign in to your B2B account/i)).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: /^Email$/i }).click();

  const emailInput = page.getByPlaceholder('you@business.com');
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.fill(email);

  const passwordInput = page.getByPlaceholder('••••••••');
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
  await passwordInput.fill(password);

  await page.getByRole('button', { name: /^Login$/i }).click();

  await page.waitForURL((url) => !/\/login(\/|$|\?)/i.test(url.pathname), { timeout: 120000 });
}

async function ensureDeliveryAddress(page: Page) {
  const saveAddr = page.getByRole('button', { name: /^Save Address$/i });
  if (await saveAddr.isVisible().catch(() => false)) {
    await page.getByPlaceholder('Label (e.g. Main Warehouse)*').fill('QA Test Warehouse');
    await page.getByPlaceholder('Street Address*').fill('1 QA Test Street');
    await page.getByPlaceholder('City*').fill('Mumbai');
    await page.getByPlaceholder('State*').fill('Maharashtra');
    await page.getByPlaceholder('Pincode*').fill('400001');
    await saveAddr.click();
    await expect(page.getByText(/Address saved/i)).toBeVisible({ timeout: 30000 });
  }
}

/** Resolves incomplete cartons (MOQ / sealed carton rules) so checkout unlocks. */
async function ensureCartReadyForCheckout(page: Page) {
  for (let i = 0; i < 8; i++) {
    const proceed = page.getByRole('button', { name: /PROCEED TO ORDER CONFIRMATION/i });
    if (await proceed.isEnabled().catch(() => false)) return;

    const autoFill = page.getByRole('button', { name: /Auto-Fill Mix/i }).first();
    if (await autoFill.isVisible().catch(() => false)) {
      await autoFill.click();
      await page.waitForTimeout(600);
      continue;
    }

    const smartAdd = page.getByRole('button', { name: /^\+\d+/ }).first();
    if (await smartAdd.isVisible().catch(() => false)) {
      await smartAdd.click();
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
}

/** When catalogue drill-down fails: URL, headings, screenshot for CI artifacts. */
async function dumpCatalogueDebug(page: Page, testSlug: string) {
  console.log('[golden-pipeline catalogue debug] URL:', page.url());
  const headings = await page.locator('h1, h2, h3').allTextContents();
  console.log('[golden-pipeline catalogue debug] visible headings:', JSON.stringify(headings, null, 0));
  const shot = `test-results/catalogue-debug-${testSlug}.png`;
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.log('[golden-pipeline catalogue debug] screenshot:', shot);
}

/**
 * Category tiles (CategoryTiles.tsx) are Framer `motion.button` with tile text inside.
 * Product rows use CatalogueProductCard — primary CTA `button` label "Add to Cart" (or "Adding…").
 */
async function drillCatalogueToFirstAddToCart(page: Page, testSlug: string) {
  await page.goto(`${PREVIEW_URL}/catalogue`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await expect(page.getByRole('heading', { name: /Shop by Category/i })).toBeVisible({ timeout: 120000 });

  const bulkTile = page
    .getByRole('button')
    .filter({ has: page.getByText('Bulk Sweets & Nuts', { exact: true }) });
  if ((await bulkTile.count()) > 0) {
    await bulkTile.first().click();
  } else {
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /Shop by Category/i }) });
    await section.getByRole('button').first().click();
  }

  const hasAddToCart = () => page.getByRole('button', { name: /Add to Cart/i });

  for (let step = 0; step < 12; step++) {
    if ((await hasAddToCart().count()) > 0) {
      await expect(hasAddToCart().first()).toBeVisible({ timeout: 30000 });
      return;
    }

    const shopByCatVisible = await page.getByRole('heading', { name: /Shop by Category/i }).isVisible().catch(() => false);
    const subcategoryButtons = page.getByRole('button').filter({ hasText: /\d+\s+products/i });

    if (!shopByCatVisible && (await subcategoryButtons.count()) > 0) {
      await subcategoryButtons.first().click();
      await page.waitForTimeout(400);
      continue;
    }

    await page.waitForTimeout(500);
  }

  await dumpCatalogueDebug(page, testSlug);
  throw new Error('Catalogue drill-down did not reach a product listing with Add to Cart');
}

/** Attach before add-to-cart attempts; captures browser console + Supabase cart-related failures. */
function attachCartAddDiagnostics(page: Page) {
  const consoleLines: string[] = [];
  const networkLines: string[] = [];

  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      consoleLines.push(`[${t}] ${msg.text()}`);
    }
  });

  page.on('response', (res) => {
    const u = res.url();
    if (res.status() < 400) return;
    if (!/order_items|\/orders(?:\?|$|\/)/i.test(u)) return;
    networkLines.push(`${res.status()} ${res.request().method()} ${u.slice(0, 280)}`);
  });

  return { consoleLines, networkLines };
}

async function waitForCartAddResult(page: Page, timeoutMs: number): Promise<'success' | 'error' | 'timeout'> {
  const deadline = Date.now() + timeoutMs;
  const success = page.getByText(/Added to cart/i).first();
  const errorToast = page
    .getByText(
      /Failed to add to cart|Failed to update cart|Could not create cart order|Please log in to add|pending B2B approval|unknown error/i,
    )
    .first();

  while (Date.now() < deadline) {
    if (await success.isVisible().catch(() => false)) return 'success';
    if (await errorToast.isVisible().catch(() => false)) return 'error';
    await page.waitForTimeout(400);
  }
  return 'timeout';
}

/**
 * CatalogueProductCard: `button` with exact label "Add to Cart" (or transient "Adding…" while `addToCart` runs).
 * Success: useCart shows toast.success("Added to cart") and replaces CTA with − / qty / + controls.
 */
async function addToCartFromCatalogueWithRetry(page: Page, testSlug: string) {
  const diag = attachCartAddDiagnostics(page);

  const n = await page.getByRole('button', { name: /^Add to Cart$/i }).count();
  if (n === 0) {
    await dumpCatalogueDebug(page, `${testSlug}-no-add-buttons`);
    throw new Error('No enabled "Add to Cart" buttons found on product listing');
  }

  for (let i = 0; i < n; i++) {
    const btn = page.getByRole('button', { name: /^Add to Cart$/i }).nth(i);
    if (!(await btn.isVisible().catch(() => false))) break;
    if (!(await btn.isEnabled().catch(() => false))) continue;

    await btn.scrollIntoViewIfNeeded();
    await btn.click();

    const result = await waitForCartAddResult(page, 40_000);
    if (result === 'success') {
      await expect(page.getByRole('button', { name: /^Adding…$/i })).toHaveCount(0, { timeout: 5000 }).catch(() => {});
      return;
    }

    await page.screenshot({ path: `test-results/post-add-click-attempt-${i}-${testSlug}.png`, fullPage: true }).catch(() => {});
    console.log(`[golden-pipeline] Add to Cart attempt ${i + 1}/${n} result: ${result}`);
    await page.waitForTimeout(600);
  }

  console.log('[golden-pipeline add failure] console (error/warning):', diag.consoleLines.join('\n') || '(none)');
  console.log('[golden-pipeline add failure] network (4xx cart-related):', diag.networkLines.join('\n') || '(none)');
  await page.screenshot({ path: `test-results/catalogue-add-failed-${testSlug}.png`, fullPage: true }).catch(() => {});
  await page.goto(`${PREVIEW_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: `test-results/cart-after-add-failed-${testSlug}.png`, fullPage: true }).catch(() => {});
  throw new Error('Add to Cart did not succeed; see post-add-click screenshots, catalogue-add-failed, cart-after-add-failed, and stdout logs');
}

async function assertBlockedFromFinanceBoard(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  const onLogin = /\/login(\/|$|\?)/i.test(url);

  const restricted = await page.getByText(/Access Restricted/i).first().isVisible().catch(() => false);
  const denied = await page.getByText(/Access Denied/i).first().isVisible().catch(() => false);
  const unauthorized = await page.getByText(/Unauthorized/i).first().isVisible().catch(() => false);

  const financeHeading = page.getByRole('heading', { name: /Finance Release Board/i });
  const financeVisible = await financeHeading.isVisible().catch(() => false);

  expect(onLogin || restricted || denied || unauthorized || !financeVisible).toBeTruthy();
}

test.describe('Golden Pipeline — End-to-End', () => {
  test.describe.configure({ mode: 'serial' });

  const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'buyer@test.oasis.local';
  const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'testpass123';
  const FINANCE_EMAIL = process.env.TEST_FINANCE_EMAIL || 'finance@test.oasis.local';
  const FINANCE_PASSWORD = process.env.TEST_FINANCE_PASSWORD || 'testpass123';
  const SALES_EMAIL = process.env.TEST_SALES_EMAIL || 'sales@test.oasis.local';
  const SALES_PASSWORD = process.env.TEST_SALES_PASSWORD || 'testpass123';

  /** First UUID segment (8 hex chars), matching Orders list and Finance `SO #` prefix. */
  let goldenOrderPrefix: string | null = null;

  test('Golden pipeline: buyer catalogue → SO → receipt upload (serial A)', async ({ page }) => {
    await login(page, BUYER_EMAIL, BUYER_PASSWORD);

    await drillCatalogueToFirstAddToCart(page, 'serial-a');
    await addToCartFromCatalogueWithRetry(page, 'serial-a');

    await page.goto(`${PREVIEW_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByRole('heading', { name: /Your Order is Empty/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /Sales Order \(SO\)/i })).toBeVisible({ timeout: 60000 });

    await ensureDeliveryAddress(page);
    await ensureCartReadyForCheckout(page);

    const proceed = page.getByRole('button', { name: /PROCEED TO ORDER CONFIRMATION/i });
    await expect(proceed).toBeEnabled({ timeout: 120000 });
    await proceed.click();

    await expect(page.getByRole('heading', { name: /Confirm Sales Order/i })).toBeVisible({ timeout: 30000 });

    await page.getByText(/Submit SO & Upload Receipt/i).click();

    const submitSo = page.getByRole('button', { name: /Submit Sales Order/i });
    await expect(submitSo).toBeVisible({ timeout: 15000 });
    await submitSo.click();

    await expect(page.getByText(/Sales Order submitted/i)).toBeVisible({ timeout: 60000 });
    await page.waitForURL(
      (u) => u.pathname === '/orders' || u.pathname.startsWith('/orders/'),
      { timeout: 120000 },
    );

    const orderLabel = page.locator('p').filter({ hasText: /^Order #[a-f0-9]+$/i }).first();
    await expect(orderLabel).toBeVisible({ timeout: 60000 });
    const raw = (await orderLabel.textContent())?.trim() ?? '';
    const m = raw.match(/Order #([a-f0-9]+)/i);
    goldenOrderPrefix = m?.[1]?.toUpperCase() ?? null;
    expect(goldenOrderPrefix).toBeTruthy();

    const uploadBtn = page.getByRole('button', { name: /Upload Receipt/i }).first();
    await expect(uploadBtn).toBeEnabled({ timeout: 30000 });
    await uploadBtn.click();

    await expect(page.getByRole('heading', { name: /Upload Payment Receipt/i })).toBeVisible({ timeout: 15000 });

    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });

    await page.getByPlaceholder('e.g., REF1234567890').fill(`QA-UTR-${Date.now()}`);

    await page.getByRole('button', { name: /Submit for Verification/i }).click();

    await expect(page.getByText(/Payment receipt uploaded/i)).toBeVisible({ timeout: 60000 });
  });

  test('Golden pipeline: finance verify → push → in production (serial B)', async ({ browser }) => {
    expect(goldenOrderPrefix, 'buyer serial test must run first and set goldenOrderPrefix').toBeTruthy();
    const prefix = goldenOrderPrefix!;

    const fp = await browser.newPage();
    await login(fp, FINANCE_EMAIL, FINANCE_PASSWORD);
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(fp.getByRole('heading', { name: /Finance Release Board/i })).toBeVisible({ timeout: 60000 });

    await fp.getByRole('tab', { name: /Awaiting Finance Review/i }).click();

    const reviewCard = fp
      .locator('div.rounded-xl.border.border-border.bg-card')
      .filter({ hasText: new RegExp(`SO #${prefix}`, 'i') })
      .filter({ has: fp.getByRole('button', { name: /^Review$/ }) })
      .first();

    await expect(reviewCard).toBeVisible({ timeout: 120000 });
    await reviewCard.getByRole('button', { name: /^Review$/ }).click();

    await expect(fp.getByRole('heading', { name: /Payment review/i })).toBeVisible({ timeout: 15000 });
    await fp.getByRole('button', { name: /^Verify$/ }).click();
    await expect(fp.getByText(/Payment verified/i)).toBeVisible({ timeout: 60000 });

    await fp.getByRole('tab', { name: /Ready for Operations/i }).click();

    const readyCard = fp
      .locator('div.rounded-xl.border.border-border.bg-card')
      .filter({ hasText: new RegExp(`SO #${prefix}`, 'i') })
      .filter({ has: fp.getByRole('button', { name: /Push to Floor/i }) })
      .first();
    await expect(readyCard).toBeVisible({ timeout: 120000 });
    await readyCard.getByRole('button', { name: /Push to Floor/i }).click();
    await expect(fp.getByText(/Released to factory floor/i)).toBeVisible({ timeout: 60000 });

    await fp.getByRole('tab', { name: /In Production/i }).click();

    const prodCard = fp
      .locator('div.rounded-xl.border.border-border.bg-card')
      .filter({ hasText: new RegExp(`SO #${prefix}`, 'i') });
    await expect(prodCard.getByText(/in production/i).first()).toBeVisible({ timeout: 120000 });

    await fp.close();
  });

  test('RBAC: Sales blocked from finance-board', async ({ browser }) => {
    const sp = await browser.newPage();
    await login(sp, SALES_EMAIL, SALES_PASSWORD);
    await sp.goto(`${PREVIEW_URL}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertBlockedFromFinanceBoard(sp);
    await sp.close();
  });

  test('RBAC: Buyer (unauthenticated visit) blocked from /admin/*', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertBlockedFromFinanceBoard(page);
  });
});
