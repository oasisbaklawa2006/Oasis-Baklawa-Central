import { test, expect } from '@playwright/test';

test('UI/UX Visual Audit and Video Capture', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-Login-Page.png', fullPage: true });

  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/02-Dashboard.png', fullPage: true });

  await page.goto('/admin/users');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/03-Users-Table.png', fullPage: true });

  await page.goto('/admin/cmd-war-room');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/04-War-Room.png', fullPage: true });
});
