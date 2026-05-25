import { test, expect } from '@playwright/test';

/**
 * Execution OS UX audit — mobile + desktop shells.
 * Run: npx playwright test tests/execution-ux-audit.spec.ts -c playwright.ux-audit.config.ts --project=iphone-14-pro
 */
const EXECUTION_ROUTES = [
  '/admin/execution/production',
  '/admin/execution/assembly',
  '/admin/execution/ready-goods',
  '/admin/execution/dispatch',
  '/admin/execution/third-party',
  '/admin/execution/retail',
  '/admin/execution/complaints',
  '/admin/execution/production?display=tv',
  '/admin/execution-command-center',
  '/admin/operational-search',
  '/admin/customer-timeline-preview',
];

for (const route of EXECUTION_ROUTES) {
  test(`execution route loads: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const resp = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(resp?.status()).toBeLessThan(500);

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow).toBe(false);

    if (route.includes('display=tv')) {
      await expect(page.getByTestId('execution-board-tv')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('toolbar', { name: /Queue actions/i })).toHaveCount(0);
      await expect(page.getByText(/TV display mode/i)).toBeVisible();
    }

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to load resource'),
    );
    expect(criticalErrors).toEqual([]);
  });
}
