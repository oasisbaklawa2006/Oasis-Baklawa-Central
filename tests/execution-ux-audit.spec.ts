import { test, expect } from '@playwright/test';

/**
 * Execution OS UX audit — mobile + desktop shells.
 * Run: npx playwright test tests/execution-ux-audit.spec.ts -c playwright.ux-audit.config.ts --project=iphone-14-pro
 */
// /admin/execution/production, /admin/execution/assembly and
// /admin/execution/ready-goods now redirect to the governed canonical
// surfaces (operational_queue_items has zero writers anywhere in
// oasis-supabase-core's migration history). They're still listed here
// (a redirect must still load without a 5xx / overflow / console error),
// but no longer carry a `?display=tv` TV-mode check -- that mode belonged
// to the retired DepartmentExecutionBoard-based production board, not its
// /operations-controller replacement.
const EXECUTION_ROUTES = [
  '/admin/execution/production',
  '/admin/execution/assembly',
  '/admin/execution/ready-goods',
  '/admin/execution/dispatch',
  '/admin/execution/third-party',
  '/admin/execution/retail',
  '/admin/execution/complaints',
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

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to load resource'),
    );
    expect(criticalErrors).toEqual([]);
  });
}
