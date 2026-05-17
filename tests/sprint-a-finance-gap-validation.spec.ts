import { test, expect } from '@playwright/test';
import {
  PREVIEW_URL,
  login,
  buyerCreateSubmittedOrderWithReceiptUpload,
} from './e2e-helpers';

/**
 * Sprint A gap checks: FIN-003 reject, FIN-004 credit+push, operations routing visibility.
 * Env: TEST_PREVIEW_URL, TEST_BUYER_*, TEST_FINANCE_*, TEST_OPERATIONS_* (required for ops test).
 */
test.describe('Sprint A — FIN-003 / FIN-004 / Operations gap validation', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'buyer@test.oasis.local';
  const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'testpass123';
  const FINANCE_EMAIL = process.env.TEST_FINANCE_EMAIL || 'finance@test.oasis.local';
  const FINANCE_PASSWORD = process.env.TEST_FINANCE_PASSWORD || 'testpass123';

  const OPS_EMAIL = process.env.TEST_OPERATIONS_EMAIL || '';
  const OPS_PASSWORD = process.env.TEST_OPERATIONS_PASSWORD || '';

  /** Set by FIN-004 for operations test */
  let creditOrderPrefix: string | null = null;

  function wireOrdersPatchCapture(page: import('@playwright/test').Page) {
    const bodies: unknown[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'PATCH') return;
      const u = req.url();
      if (!/\/rest\/v1\/orders(\?|$)/.test(u)) return;
      const raw = req.postData();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) bodies.push(...parsed);
        else bodies.push(parsed);
      } catch {
        bodies.push(raw);
      }
    });
    return bodies;
  }

  function wireAuditInsertCapture(page: import('@playwright/test').Page) {
    const bodies: unknown[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      if (!/\/rest\/v1\/audit_logs(\?|$)/.test(req.url())) return;
      const raw = req.postData();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) bodies.push(...parsed);
        else bodies.push(parsed);
      } catch {
        bodies.push(raw);
      }
    });
    return bodies;
  }

  test('FIN-003: finance rejects with reason → awaiting_receipt + audit; buyer visibility', async ({
    page,
    browser,
  }) => {
    await login(page, BUYER_EMAIL, BUYER_PASSWORD);
    const { prefix, rejectReasonMarker } = await buyerCreateSubmittedOrderWithReceiptUpload(page, 'fin003');

    const fp = await browser.newPage();
    const orderPatches = wireOrdersPatchCapture(fp);
    const auditPosts = wireAuditInsertCapture(fp);

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
    await fp.getByPlaceholder(/Required only when rejecting payment/i).fill(rejectReasonMarker);

    await fp.getByRole('button', { name: /^Reject$/i }).click();
    await expect(fp.getByText(/Buyer asked to update payment receipt/i)).toBeVisible({ timeout: 60000 });

    const rejectPatch = [...orderPatches]
      .reverse()
      .find((p) => (p as Record<string, unknown>)?.payment_status === 'awaiting_receipt') as
      | Record<string, unknown>
      | undefined;
    expect(rejectPatch?.payment_status, 'orders PATCH should set awaiting_receipt').toBe('awaiting_receipt');

    const audit = auditPosts.find(
      (b) =>
        typeof b === 'object' &&
        b !== null &&
        (b as { action_type?: string }).action_type === 'finance_board_reject',
    ) as { reason?: string } | undefined;
    expect(audit?.reason, 'audit_logs should store rejection reason').toContain(rejectReasonMarker);

    await fp.close();

    await page.goto(`${PREVIEW_URL}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByText(/Upload Receipt Required/i).first()).toBeVisible({ timeout: 60000 });

    const buyerHtml = await page.content();
    expect(
      buyerHtml.includes(rejectReasonMarker),
      'buyer should not see raw finance rejection reason in Orders HTML (PARTIAL if product requires buyer-visible reason)',
    ).toBe(false);

    await expect(page.getByText(new RegExp(`Order #${prefix}`, 'i')).first()).toBeVisible({ timeout: 30000 });
  });

  test('FIN-004: approve credit → on_credit PATCH → ready lane → push → in production', async ({ page, browser }) => {
    await login(page, BUYER_EMAIL, BUYER_PASSWORD);
    const { prefix } = await buyerCreateSubmittedOrderWithReceiptUpload(page, 'fin004');
    creditOrderPrefix = prefix;

    const fp = await browser.newPage();
    const orderPatches = wireOrdersPatchCapture(fp);

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
    await fp.getByRole('button', { name: /^Approve Credit$/i }).click();
    await expect(fp.getByText(/Credit approved/i)).toBeVisible({ timeout: 60000 });

    const creditPatch = [...orderPatches].reverse().find((p) => {
      const o = p as Record<string, unknown>;
      return o?.payment_status === 'on_credit';
    }) as Record<string, unknown> | undefined;

    expect(creditPatch?.payment_status).toBe('on_credit');
    expect(typeof creditPatch?.finance_verified_by).toBe('string');
    expect(typeof creditPatch?.finance_verified_at).toBe('string');

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

  test('Operations role: /admin/operations shows pushed order (routing tab)', async ({ browser }) => {
    expect(creditOrderPrefix, 'FIN-004 must run first and set creditOrderPrefix').toBeTruthy();
    const prefix = creditOrderPrefix!;

    test.skip(!OPS_EMAIL || !OPS_PASSWORD, 'Set TEST_OPERATIONS_EMAIL and TEST_OPERATIONS_PASSWORD for operations role validation.');

    const op = await browser.newPage();
    await login(op, OPS_EMAIL, OPS_PASSWORD);
    await op.goto(`${PREVIEW_URL}/admin/operations`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await expect(op.getByRole('heading', { name: /Factory Control/i })).toBeVisible({ timeout: 60000 });

    const idHeading = op.getByText(new RegExp(`#${prefix}`, 'i'));
    await expect(idHeading.first()).toBeVisible({ timeout: 120000 });

    await expect(op.getByText(/Qty:/i).first()).toBeVisible({ timeout: 30000 });
    await expect(op.getByText(/Pack:/i).first()).toBeVisible({ timeout: 30000 });
    await expect(op.getByRole('combobox').or(op.getByText(/Route to Dept/i)).first()).toBeVisible({ timeout: 30000 });

    await op.close();
  });
});
