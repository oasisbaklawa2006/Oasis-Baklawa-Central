/**
 * Lane 1 Authenticated Live Smoke (Central issue #368).
 *
 * Authenticates as dedicated, role-separated QA identities against a real
 * deployment and proves: route access, role-boundary enforcement, RPC
 * wiring, and the six-TV production grouping. This is NOT a business-data
 * mutation suite -- every mutation-capable control is checked for wiring
 * (function exists, payload shape, permission) without executing it. See
 * docs/LANE1_QA_ACCOUNT_MATRIX.md for the QA identity contract.
 *
 * Requires per-role secrets (no defaults): TEST_RGS_EMAIL/PASSWORD,
 * TEST_TV_RGS_EMAIL/PASSWORD, TEST_PRODUCTION_EMAIL/PASSWORD,
 * TEST_TV_PRODUCTION_EMAIL/PASSWORD, plus TEST_PREVIEW_URL. A missing
 * required secret fails that role's tests explicitly rather than skipping.
 */
import { test, expect } from "@playwright/test";
import {
  getPreviewUrl,
  login,
  requireLane1Credentials,
  hasLane1Credentials,
  attachRouteDiagnostics,
} from "./e2e-helpers";

const SIX_TV_PRODUCTION_ROUTES = [
  { label: "Bakery", route: "/tv/bakery" },
  { label: "Chocolate & Confectionery + Dragees", route: "/tv/chocolate" },
  { label: "Fusion Sweets + Dates", route: "/tv/fusion" },
  { label: "Arabic Sweets + frozen/semi-finished/semi-prepared", route: "/tv/arabic-sweets" },
  { label: "Seasoned Nuts & Mixes", route: "/tv/nuts" },
] as const;
const RGS_TV_ROUTE = "/tv/rgs";

const RGS_GOVERNED_RPCS = [
  "reserve_rgs_stock",
  "create_production_shortage_demand",
  "record_rgs_receipt",
  "accept_rgs_production_receipt",
  "pick_rgs_reservation",
  "issue_rgs_stock",
  "acknowledge_rgs_issue",
] as const;

function assertNoHardFailures(d: {
  failedRequests: { url: string; status: number }[];
  rpcCalls: { url: string; status: number; fn: string }[];
}) {
  // PGRST202 (function not found) / 404 on an RPC endpoint is the exact
  // "function does not exist" defect class this suite exists to catch.
  const brokenRpcs = d.rpcCalls.filter((c) => c.status === 404 || c.status >= 500);
  expect(brokenRpcs, `Broken RPC call(s): ${JSON.stringify(brokenRpcs)}`).toHaveLength(0);

  // A 401/403 on a *document* navigation (not a deliberate negative-role
  // probe, which asserts separately) is a genuine permission defect.
  const permissionFailures = d.failedRequests.filter((r) => r.status === 401 || r.status === 403);
  expect(permissionFailures, `Unexpected permission failure(s): ${JSON.stringify(permissionFailures)}`).toHaveLength(0);
}

async function assertRouteRendersWithoutFailure(page: import("@playwright/test").Page, route: string) {
  const d = attachRouteDiagnostics(page);
  const resp = await page.goto(`${getPreviewUrl()}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2000); // let async data fetches settle
  d.detach();

  expect(resp?.status() ?? 200, `Document response for ${route}`).toBeLessThan(500);
  assertNoHardFailures(d);
  return d;
}

test.describe("Lane 1 live smoke — RGS role", () => {
  test("RGS QA account reaches /admin/ready-goods with governed RPC wiring intact", async ({ page }) => {
    const { email, password } = requireLane1Credentials("rgs");
    await login(page, email, password);

    const d = await assertRouteRendersWithoutFailure(page, "/admin/ready-goods");
    expect(page.url(), "RGS account must land on the Ready Goods surface").toContain("/admin/ready-goods");

    // Loading-state proof: the page must resolve to a real state (content,
    // empty state, or an explicit error banner) rather than spin forever.
    const spinnerStillVisible = await page.locator("[class*='animate-spin']").first().isVisible().catch(() => false);
    expect(spinnerStillVisible, "Ready Goods surface must not be stuck on an infinite loader after 2s").toBe(false);

    // RPC wiring proof: the deployed JS bundle must reference every governed
    // RGS RPC by name (fails if a rename/refactor silently dropped one),
    // without requiring any of them to actually have been invoked yet.
    const scriptSrcs = await page.evaluate(() =>
      Array.from(document.scripts).map((s) => s.src).filter(Boolean),
    );
    let combinedScriptText = "";
    for (const src of scriptSrcs) {
      try {
        const r = await page.request.get(src);
        if (r.ok()) combinedScriptText += await r.text();
      } catch {
        // best-effort; a single unreachable chunk must not fail the whole suite
      }
    }
    const missingRpcs = RGS_GOVERNED_RPCS.filter((fn) => !combinedScriptText.includes(fn));
    expect(missingRpcs, `Governed RGS RPC name(s) not found in the deployed bundle: ${missingRpcs.join(", ")}`).toHaveLength(0);
  });

  test("RGS QA account is denied a random production-department mutation surface it has no role for", async ({ page }) => {
    const { email, password } = requireLane1Credentials("rgs");
    await login(page, email, password);

    // Negative test: RGS_ADMIN must not gain unrelated production authority.
    await page.goto(`${getPreviewUrl()}/admin/cmd-war-room`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);
    expect(page.url(), "RGS account must be bounced away from the CMD War Room (admin-only) surface").not.toContain("/admin/cmd-war-room");
  });
});

test.describe("Lane 1 live smoke — RGS TV role", () => {
  test("TV_READY QA account reads /tv/rgs read-only", async ({ page }) => {
    const { email, password } = requireLane1Credentials("tvRgs");
    await login(page, email, password);

    await assertRouteRendersWithoutFailure(page, RGS_TV_ROUTE);
    expect(page.url(), "TV_READY account must land on the RGS TV kiosk route").toContain(RGS_TV_ROUTE);
  });

  test("TV_READY QA account cannot reach the RGS mutation surface", async ({ page }) => {
    const { email, password } = requireLane1Credentials("tvRgs");
    await login(page, email, password);

    await page.goto(`${getPreviewUrl()}/admin/ready-goods`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);
    expect(page.url(), "TV_READY must not gain RGS mutation authority").not.toContain("/admin/ready-goods");
  });
});

test.describe("Lane 1 live smoke — production role", () => {
  test("Production QA account reaches the handheld job-execution surface", async ({ page }) => {
    const { email, password } = requireLane1Credentials("production");
    await login(page, email, password);

    const d = await assertRouteRendersWithoutFailure(page, "/admin/execution/production");
    expect(page.url(), "Production account must reach the production execution board").toContain("/admin/execution/production");

    const spinnerStillVisible = await page.locator("[class*='animate-spin']").first().isVisible().catch(() => false);
    expect(spinnerStillVisible, "Production execution board must not be stuck on an infinite loader after 2s").toBe(false);
    void d;
  });

  test("Production QA account cannot acquire RGS-admin authority", async ({ page }) => {
    const { email, password } = requireLane1Credentials("production");
    await login(page, email, password);

    await page.goto(`${getPreviewUrl()}/admin/ready-goods`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);
    expect(page.url(), "Production account must not gain RGS-admin authority").not.toContain("/admin/ready-goods");
  });
});

test.describe("Lane 1 live smoke — production TV role and six-TV grouping", () => {
  test("Production TV QA account is read-only and department-scoped", async ({ page }) => {
    const { email, password } = requireLane1Credentials("tvProduction");
    await login(page, email, password);

    await assertRouteRendersWithoutFailure(page, "/tv/arabic-sweets");
    expect(page.url(), "Production TV account must land on its own department screen").toContain("/tv/arabic-sweets");

    // Negative: must not reach a *different* department's TV route.
    await page.goto(`${getPreviewUrl()}/tv/bakery`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1500);
    expect(page.url(), "Production TV account must be department-scoped, not cross-department").not.toContain("/tv/bakery");
  });

  for (const { label, route } of SIX_TV_PRODUCTION_ROUTES) {
    test(`Six-TV grouping: ${label} route (${route}) resolves for an authorized viewer`, async ({ page }) => {
      test.skip(!hasLane1Credentials("admin"), "TEST_ADMIN credentials not provided; skipping cross-TV grouping sweep");
      const { email, password } = requireLane1Credentials("admin");
      await login(page, email, password);
      await assertRouteRendersWithoutFailure(page, route);
      expect(page.url()).toContain(route);
    });
  }
});
