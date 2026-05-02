import { test, expect } from '@playwright/test';

test('UI/UX Visual Audit and Video Capture', async ({ page }) => {
  const baseUrl = 'https://b2b.oasisbaklawa.com'; 
  
  await page.goto(`${baseUrl}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-Login-Page.png', fullPage: true });

  await page.goto(`${baseUrl}/admin`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/02-Dashboard.png', fullPage: true });

  await page.goto(`${baseUrl}/admin/users`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/03-Users-Table.png', fullPage: true });

  await page.goto(`${baseUrl}/admin/cmd-war-room`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/04-War-Room.png', fullPage: true });
});
