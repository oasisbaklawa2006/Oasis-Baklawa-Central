import { test, expect } from '@playwright/test';
import {
  getPreviewUrl,
  login,
  buyerCreateSubmittedOrderWithReceiptUpload,
  assertBlockedFromFinanceBoard,
  requireFinanceMutationCredentials,
  requireEnv,
} from './e2e-helpers';

test.describe('Golden Pipeline — End-to-End', () => {
  test.describe.configure({ mode: 'serial' });

  /** First UUID segment (8 hex chars), matching Orders list and Finance `SO #` prefix. */
  let goldenOrderPrefix: string | null = null;

  test('Golden pipeline: buyer catalogue → SO → receipt upload (serial A)', async ({ page }) => {
    test.skip(
      process.env.ALLOW_FINANCE_E2E_MUTATIONS !== 'true',
      'Set ALLOW_FINANCE_E2E_MUTATIONS=true and TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD, TEST_FINANCE_EMAIL, TEST_FINANCE_PASSWORD for mutating golden pipeline E2E.',
    );
    const { buyerEmail, buyerPassword } = requireFinanceMutationCredentials();

    await login(page, buyerEmail, buyerPassword);

    const { prefix } = await buyerCreateSubmittedOrderWithReceiptUpload(page, 'serial-a');
    goldenOrderPrefix = prefix;
  });

  test('Golden pipeline: finance verify → push → in production (serial B)', async ({ browser }) => {
    test.skip(
      process.env.ALLOW_FINANCE_E2E_MUTATIONS !== 'true',
      'Set ALLOW_FINANCE_E2E_MUTATIONS=true and finance credentials for verify/push E2E.',
    );
    expect(goldenOrderPrefix, 'buyer serial test must run first and set goldenOrderPrefix').toBeTruthy();
    const prefix = goldenOrderPrefix!;

    const financeEmail = requireEnv('TEST_FINANCE_EMAIL');
    const financePassword = requireEnv('TEST_FINANCE_PASSWORD');

    const fp = await browser.newPage();
    await login(fp, financeEmail, financePassword);
    const preview = getPreviewUrl();
    await fp.goto(`${preview}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
    test.skip(
      !process.env.TEST_SALES_EMAIL?.trim() || !process.env.TEST_SALES_PASSWORD?.trim(),
      'Set TEST_SALES_EMAIL and TEST_SALES_PASSWORD to run sales RBAC E2E (no default credentials).',
    );
    const salesEmail = requireEnv('TEST_SALES_EMAIL');
    const salesPassword = requireEnv('TEST_SALES_PASSWORD');

    const sp = await browser.newPage();
    await login(sp, salesEmail, salesPassword);
    const previewSales = getPreviewUrl();
    await sp.goto(`${previewSales}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertBlockedFromFinanceBoard(sp);
    await sp.close();
  });

  test('RBAC: Buyer (unauthenticated visit) blocked from /admin/*', async ({ page }) => {
    const preview = getPreviewUrl();
    await page.goto(`${preview}/admin/finance-board`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertBlockedFromFinanceBoard(page);
  });
});
