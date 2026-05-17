import { expect, type Page } from '@playwright/test';

/** Preview / app base URL (set `TEST_PREVIEW_URL` for hosted QA). */
export const PREVIEW_URL = process.env.TEST_PREVIEW_URL || 'http://localhost:3000';

export async function login(page: Page, email: string, password: string) {
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

export async function ensureDeliveryAddress(page: Page) {
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

export async function ensureCartReadyForCheckout(page: Page) {
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

async function dumpCatalogueDebug(page: Page, testSlug: string) {
  console.log('[e2e catalogue debug] URL:', page.url());
  const headings = await page.locator('h1, h2, h3').allTextContents();
  console.log('[e2e catalogue debug] visible headings:', JSON.stringify(headings, null, 0));
  const shot = `test-results/catalogue-debug-${testSlug}.png`;
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  console.log('[e2e catalogue debug] screenshot:', shot);
}

export async function drillCatalogueToFirstAddToCart(page: Page, testSlug: string) {
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

export async function addToCartFromCatalogueWithRetry(page: Page, testSlug: string) {
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
    console.log(`[e2e] Add to Cart attempt ${i + 1}/${n} result: ${result}`);
    await page.waitForTimeout(600);
  }

  console.log('[e2e add failure] console:', diag.consoleLines.join('\n') || '(none)');
  console.log('[e2e add failure] network:', diag.networkLines.join('\n') || '(none)');
  await page.screenshot({ path: `test-results/catalogue-add-failed-${testSlug}.png`, fullPage: true }).catch(() => {});
  await page.goto(`${PREVIEW_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  throw new Error('Add to Cart did not succeed');
}

/**
 * Buyer: catalogue → cart → submit SO → orders → upload receipt → under_review.
 * @returns order id prefix (first UUID segment, uppercase) for finance board SO # match.
 */
export async function buyerCreateSubmittedOrderWithReceiptUpload(
  page: Page,
  slug: string,
): Promise<{ prefix: string; rejectReasonMarker: string }> {
  await drillCatalogueToFirstAddToCart(page, slug);
  await addToCartFromCatalogueWithRetry(page, slug);

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
  await page.waitForURL((u) => u.pathname === '/orders' || u.pathname.startsWith('/orders/'), { timeout: 120000 });

  const orderLabel = page.locator('p').filter({ hasText: /^Order #[a-f0-9]+$/i }).first();
  await expect(orderLabel).toBeVisible({ timeout: 60000 });
  const raw = (await orderLabel.textContent())?.trim() ?? '';
  const m = raw.match(/Order #([a-f0-9]+)/i);
  const prefix = m?.[1]?.toUpperCase() ?? '';
  expect(prefix).toBeTruthy();

  const uploadBtn = page.getByRole('button', { name: /Upload Receipt/i }).first();
  await expect(uploadBtn).toBeEnabled({ timeout: 30000 });
  await uploadBtn.click();

  await expect(page.getByRole('heading', { name: /Upload Payment Receipt/i })).toBeVisible({ timeout: 15000 });

  await page.locator('input[type="file"]').setInputFiles({
    name: 'test-receipt.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fake-image-bytes'),
  });

  const utr = `QA-UTR-${slug}-${Date.now()}`;
  await page.getByPlaceholder('e.g., REF1234567890').fill(utr);

  await page.getByRole('button', { name: /Submit for Verification/i }).click();

  await expect(page.getByText(/Payment receipt uploaded/i)).toBeVisible({ timeout: 60000 });

  return { prefix, rejectReasonMarker: `FIN003-REJECT-${Date.now()}` };
}

export async function assertBlockedFromFinanceBoard(page: Page) {
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
