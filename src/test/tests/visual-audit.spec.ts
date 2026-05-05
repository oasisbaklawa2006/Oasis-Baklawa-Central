import { test, expect } from '@playwright/test';

test('UI/UX Visual Audit and Video Capture', async ({ page }) => {
  // 1. Go to the main URL
  const baseUrl = 'https://b2b.oasisbaklawa.com'; // Change to lovable preview URL if needed
  
  await page.goto(`${baseUrl}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-Login-Page.png', fullPage: true });

  // 2. Perform Login (Update these selectors based on your actual inputs)
  // Uncomment and adjust these if your pages are locked behind auth!
  /*
  await page.fill('input[type="email"]', 'dinesh@oasisbaklawa.com');
  await page.fill('input[type="password"]', 'your_test_password');
  await page.click('button:has-text("Login")');
  await page.waitForURL('**' + '/admin*');
  */

  // 3. Visit Dashboard
  await page.goto(`${baseUrl}/admin`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/02-Dashboard.png', fullPage: true });

  // 4. Visit Users Page
  await page.goto(`${baseUrl}/admin/users`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/03-Users-Table.png', fullPage: true });

  // 5. Visit War Room / Triage
  await page.goto(`${baseUrl}/admin/cmd-war-room`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/04-War-Room.png', fullPage: true });

  // Add as many pages as you want here...
});
