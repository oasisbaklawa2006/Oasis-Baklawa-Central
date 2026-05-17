import { test, expect } from '@playwright/test';
import {
  PREVIEW_URL,
  login,
  buyerCreateSubmittedOrderWithReceiptUpload,
  assertBlockedFromFinanceBoard,
} from './e2e-helpers';

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

    const { prefix } = await buyerCreateSubmittedOrderWithReceiptUpload(page, 'serial-a');
    goldenOrderPrefix = prefix;
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
