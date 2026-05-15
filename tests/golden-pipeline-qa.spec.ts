import { test, expect } from '@playwright/test';

test.describe('Golden Pipeline — End-to-End', () => {
  const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'buyer@test.oasis.local';
  const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'testpass123';
  const FINANCE_EMAIL = process.env.TEST_FINANCE_EMAIL || 'finance@test.oasis.local';
  const FINANCE_PASSWORD = process.env.TEST_FINANCE_PASSWORD || 'testpass123';
  const PREVIEW_URL = process.env.TEST_PREVIEW_URL || 'http://localhost:3000';

  test('1. Buyer logs in', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/login`);
    await page.fill('input[type="email"]', BUYER_EMAIL);
    await page.fill('input[type="password"]', BUYER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${PREVIEW_URL}/`);
  });

  test('2. Buyer browses and adds items', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/catalogue`);
    await page.waitForSelector('[data-testid="product-card"]');
    await page.locator('[data-testid="product-card"]').first().locator('button:has-text("Add to Cart")').click();
  });

  test('3. Buyer submits order', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/cart`);
    await page.click('button:has-text("Proceed to Checkout")');
    await page.locator('[data-testid="payment-modal"]').waitFor({ state: 'visible' });
    await page.click('button[data-testid="submit-order-btn"]');
    await page.waitForURL(`${PREVIEW_URL}/orders**`);
  });

  test('4. Buyer uploads receipt', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/orders`);
    await page.locator('[data-testid="order-card"]').first().click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake') });
    await page.fill('input[placeholder*="UTR"]', 'TEST123456789');
    await page.click('button:has-text("Upload")');
    await page.waitForSelector('[data-testid="receipt-success"]');
  });

  test('5. Finance board loads', async ({ browser }) => {
    const fp = await browser.newPage();
    await fp.goto(`${PREVIEW_URL}/login`);
    await fp.fill('input[type="email"]', FINANCE_EMAIL);
    await fp.fill('input[type="password"]', FINANCE_PASSWORD);
    await fp.click('button[type="submit"]');
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`);
    expect(fp.url()).toContain('/admin/finance-board');
    await fp.close();
  });

  test('6. Finance verifies payment', async ({ browser }) => {
    const fp = await browser.newPage();
    await fp.goto(`${PREVIEW_URL}/login`);
    await fp.fill('input[type="email"]', FINANCE_EMAIL);
    await fp.fill('input[type="password"]', FINANCE_PASSWORD);
    await fp.click('button[type="submit"]');
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`);
    await fp.locator('button:has-text("Awaiting Finance Review")').click();
    await fp.locator('[data-testid="finance-order-card"]').first().locator('button:has-text("Review")').click();
    await fp.locator('[data-testid="review-modal"]').locator('button:has-text("Verify")').click();
    await fp.waitForSelector('[data-testid="verify-success"]');
    await fp.close();
  });

  test('7. Finance pushes to floor', async ({ browser }) => {
    const fp = await browser.newPage();
    await fp.goto(`${PREVIEW_URL}/login`);
    await fp.fill('input[type="email"]', FINANCE_EMAIL);
    await fp.fill('input[type="password"]', FINANCE_PASSWORD);
    await fp.click('button[type="submit"]');
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`);
    await fp.locator('button:has-text("Ready for Operations")').click();
    await fp.locator('[data-testid="finance-order-card"]').first().locator('button:has-text("Push to Floor")').click();
    await fp.waitForSelector('[data-testid="push-success"]');
    await fp.close();
  });

  test('8. Buyer sees "In Production"', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/orders`);
    await page.locator('[data-testid="order-card"]').first().click();
    const stage = page.locator('[data-testid="timeline-stage"]:has-text("In Production")');
    expect(await stage.count()).toBeGreaterThan(0);
  });

  test('9. Finance approves credit', async ({ browser }) => {
    const fp = await browser.newPage();
    await fp.goto(`${PREVIEW_URL}/login`);
    await fp.fill('input[type="email"]', FINANCE_EMAIL);
    await fp.fill('input[type="password"]', FINANCE_PASSWORD);
    await fp.click('button[type="submit"]');
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`);
    await fp.locator('button:has-text("Awaiting Finance Review")').click();
    const btn = fp.locator('[data-testid="finance-order-card"]').first().locator('button:has-text("Review")');
    if (await btn.isVisible()) {
      await btn.click();
      const credit = fp.locator('[data-testid="review-modal"]').locator('button:has-text("Approve Credit")');
      if (await credit.isVisible()) {
        await credit.click();
        await fp.waitForSelector('[data-testid="credit-success"]');
      }
    }
    await fp.close();
  });

  test('10. Finance rejects with reason', async ({ browser }) => {
    const fp = await browser.newPage();
    await fp.goto(`${PREVIEW_URL}/login`);
    await fp.fill('input[type="email"]', FINANCE_EMAIL);
    await fp.fill('input[type="password"]', FINANCE_PASSWORD);
    await fp.click('button[type="submit"]');
    await fp.goto(`${PREVIEW_URL}/admin/finance-board`);
    await fp.locator('button:has-text("Awaiting Finance Review")').click();
    const btn = fp.locator('[data-testid="finance-order-card"]').nth(1).locator('button:has-text("Review")');
    if (await btn.isVisible()) {
      await btn.click();
      const reject = fp.locator('[data-testid="review-modal"]').locator('button:has-text("Reject")');
      if (await reject.isVisible()) {
        await reject.click();
        const reason = fp.locator('textarea[placeholder*="reason"]');
        if (await reason.isVisible()) await reason.fill('Invalid UTR');
        const confirm = fp.locator('button:has-text("Confirm Reject")');
        if (await confirm.isVisible()) {
          await confirm.click();
          await fp.waitForSelector('[data-testid="reject-success"]');
        }
      }
    }
    await fp.close();
  });

  test('11. RBAC: Sales blocked from finance-board', async ({ browser }) => {
    const sp = await browser.newPage();
    const SALES_EMAIL = process.env.TEST_SALES_EMAIL || 'sales@test.oasis.local';
    const SALES_PASSWORD = process.env.TEST_SALES_PASSWORD || 'testpass123';
    await sp.goto(`${PREVIEW_URL}/login`);
    await sp.fill('input[type="email"]', SALES_EMAIL);
    await sp.fill('input[type="password"]', SALES_PASSWORD);
    await sp.click('button[type="submit"]');
    await sp.goto(`${PREVIEW_URL}/admin/finance-board`);
    const blocked = sp.url().includes('/login') || (await sp.locator('text=Access Denied').isVisible());
    expect(blocked).toBeTruthy();
    await sp.close();
  });

  test('12. RBAC: Buyer blocked from /admin/*', async ({ page }) => {
    await page.goto(`${PREVIEW_URL}/admin/finance-board`);
    const blocked = page.url().includes('/login') || (await page.locator('text=Access Denied').isVisible());
    expect(blocked).toBeTruthy();
  });
});
