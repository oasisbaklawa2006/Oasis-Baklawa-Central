/**
 * Factory operations viewport certification (RGS/Production closure).
 *
 * Non-mutating, read-only smoke coverage for the Arabic Sweets TV
 * (/tv/arabic-sweets) and Operations Controller (/operations-controller)
 * across the device classes the owner's factory-floor estate actually
 * runs on: handheld phones, a tablet, a desktop admin session, and a
 * wall-mounted TV-sized viewport.
 *
 * Requires TEST_TV_PRODUCTION_EMAIL/PASSWORD (Arabic Sweets TV) and
 * TEST_PRODUCTION_EMAIL/PASSWORD (Operations Controller), plus
 * TEST_PREVIEW_URL -- see docs/LANE1_QA_ACCOUNT_MATRIX.md. When those
 * secrets are not present (e.g. this sandbox), every test in this file
 * skips explicitly rather than failing or silently passing -- see
 * factory-operations-certification-summary.md, which records this as
 * CREDENTIAL_REQUIRED rather than "human only".
 */
import { test, expect, type Page } from "@playwright/test";
import { getPreviewUrl, login, hasLane1Credentials, requireLane1Credentials, attachRouteDiagnostics } from "./e2e-helpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14 Pro", width: 393, height: 852 },
  { name: "iPad", width: 820, height: 1180 },
  { name: "Desktop", width: 1440, height: 1200 },
  { name: "TV (wall display)", width: 1920, height: 1080 },
] as const;

async function certifyRoute(page: Page, route: string, expectPathSubstring: string) {
  await page.setViewportSize({ width: 1440, height: 1200 }); // reset between iterations
  const d = attachRouteDiagnostics(page);
  const resp = await page.goto(`${getPreviewUrl()}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  expect(resp?.status() ?? 200, `Document response for ${route}`).toBeLessThan(500);
  expect(page.url(), `${route} must actually render (not bounced elsewhere)`).toContain(expectPathSubstring);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // No blank body -- the shell rendered *some* content at this size.
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length, `${route} body must not be blank at ${vp.name} (${vp.width}x${vp.height})`).toBeGreaterThan(0);

    // No horizontal overflow -- content must not force horizontal scroll.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow, `${route} must not overflow horizontally at ${vp.name} (${vp.width}x${vp.height})`).toBe(false);
  }

  d.detach();
  const brokenRpcs = d.rpcCalls.filter((c) => c.status === 404 || c.status >= 500);
  expect(brokenRpcs, `Broken RPC call(s) on ${route}: ${JSON.stringify(brokenRpcs)}`).toHaveLength(0);
  expect(d.consoleErrors, `Uncaught console error(s) on ${route}: ${JSON.stringify(d.consoleErrors)}`).toEqual([]);
}

test.describe("Factory ops viewport certification — Arabic Sweets TV", () => {
  test("renders cleanly across handheld/tablet/desktop/TV viewports with no console errors or overflow", async ({ page }) => {
    test.skip(!hasLane1Credentials("tvProduction"), "TEST_TV_PRODUCTION credentials not provided; CREDENTIAL_REQUIRED");
    const { email, password } = requireLane1Credentials("tvProduction");
    await login(page, email, password);
    await certifyRoute(page, "/tv/arabic-sweets", "/tv/arabic-sweets");
  });

  // Golden regression case: SO#ABB4287E / OAS-RIN-3, governed job E3ED28B0,
  // canonical_department=ARABIC_SWEETS, status=pending, assigned=6,
  // produced=0. Component-level coverage of this exact row already exists
  // in src/components/__tests__/FactoryTVModule.test.tsx; this only proves
  // the live TV shell does not error, since asserting the job itself
  // requires live seed data this sandbox cannot provision.
  test("shows some production job content when the department has open jobs (best-effort, non-mutating)", async ({ page }) => {
    test.skip(!hasLane1Credentials("tvProduction"), "TEST_TV_PRODUCTION credentials not provided; CREDENTIAL_REQUIRED");
    const { email, password } = requireLane1Credentials("tvProduction");
    await login(page, email, password);
    await page.goto(`${getPreviewUrl()}/tv/arabic-sweets`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(
      page.locator("[class*='animate-spin']").first(),
      "Arabic Sweets TV must not be stuck on an infinite loader",
    ).toBeHidden({ timeout: 15_000 });
    // Read-only assertion only -- does not require or assume any specific
    // job is present, since live data is outside this suite's control.
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(0);
  });
});

test.describe("Factory ops viewport certification — Operations Controller", () => {
  test("renders cleanly across handheld/tablet/desktop/TV viewports with no console errors or overflow", async ({ page }) => {
    test.skip(!hasLane1Credentials("production"), "TEST_PRODUCTION credentials not provided; CREDENTIAL_REQUIRED");
    const { email, password } = requireLane1Credentials("production");
    await login(page, email, password);
    await certifyRoute(page, "/operations-controller", "/operations-controller");
  });
});
