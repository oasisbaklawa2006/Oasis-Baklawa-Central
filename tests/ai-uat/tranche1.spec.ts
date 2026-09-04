import { expect, test, type Page } from "@playwright/test";
import { getAiUatCase, type AiUatCase } from "../../src/lib/ai-uat/catalogue";
import { getPreviewUrl } from "../e2e-helpers";
import {
  attachSafeDiagnostics,
  clickLogout,
  hasRoleCredentials,
  loginWithPrefix,
  openAllTools,
  probeForbiddenRoutes,
  runBoundedAiExploration,
  safeEvidenceScreenshot,
  writeEvidence,
} from "./runtime";

// Credentials are entered with repo-wide Playwright tracing/video/screenshots disabled.
// Diagnostics begin before authentication; visual evidence starts only after login succeeds.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });

type CredentialPrefix = "TEST_DISPATCH" | "TEST_ASSEMBLY";

async function blockIfMissingCredentials(page: Page, testCase: AiUatCase, prefixes: CredentialPrefix[]) {
  const missing = prefixes.filter((prefix) => !hasRoleCredentials(prefix));
  if (missing.length === 0) return false;
  await writeEvidence({
    page,
    testCase,
    status: "BLOCKED",
    actual: `Missing required role credentials: ${missing.join(", ")}`,
    severity: "INFO",
  });
  test.skip(true, `Missing required AI-UAT secrets: ${missing.join(", ")}`);
  return true;
}

async function executeCase(
  page: Page,
  testCase: AiUatCase,
  body: (ctx: { diagnostics: ReturnType<typeof attachSafeDiagnostics>; screenshots: string[] }) => Promise<string>,
  loginPrefix?: CredentialPrefix,
) {
  const diagnostics = attachSafeDiagnostics(page);
  const screenshots: string[] = [];
  try {
    if (loginPrefix) {
      await loginWithPrefix(page, loginPrefix);
      await page.waitForLoadState("domcontentloaded");
    }

    // Never capture a screenshot before credential entry has completed.
    const initial = await safeEvidenceScreenshot(page, testCase, "initial");
    if (initial) screenshots.push(initial);
    const actual = await body({ diagnostics, screenshots });
    const aiActions = await runBoundedAiExploration(page, testCase);
    const final = await safeEvidenceScreenshot(page, testCase, "final");
    if (final) screenshots.push(final);
    diagnostics.detach();
    await writeEvidence({ page, testCase, status: "PASS", actions: aiActions, actual, diagnostics, screenshots });
  } catch (error) {
    diagnostics.detach();
    const message = error instanceof Error ? error.message : String(error);
    await writeEvidence({
      page,
      testCase,
      status: "FAIL",
      actual: loginPrefix && /login|auth|credential|password|email/i.test(message) ? "Credentialed login or authenticated scenario failed; see sanitized diagnostics." : message,
      diagnostics,
      screenshots,
      severity: /UAT-00[1-7]|UAT-010/.test(testCase.id) ? "P0" : "P1",
    });
    throw error;
  }
}

async function expectCleanLoginDenial(page: Page, context: string) {
  await expect(page, `${context} must land on the canonical Login route`).toHaveURL(/\/login(?:$|\?|\/)/, { timeout: 8_000 });
  await expect(page.getByRole("button", { name: /^Login$/i }), `${context} must render the Login control`).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/404|page not found|something went wrong|unexpected error/i)).toHaveCount(0);
}

test("UAT-001 — logout terminates access", async ({ page }) => {
  const testCase = getAiUatCase("UAT-001");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    await clickLogout(page);
    await expectCleanLoginDenial(page, "Logout");
    await page.goto(`${getPreviewUrl()}/admin/dispatch-mgmt`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expectCleanLoginDenial(page, "Logged-out Dispatch direct revisit");
    await expect(page.getByText(/Governed carton.*DPL authority/i)).toHaveCount(0);
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    return "Logout reached Login and a direct Dispatch revisit returned to Login without restoring authenticated Dispatch content.";
  }, "TEST_DISPATCH");
});

test("UAT-002 — anonymous direct URL protection", async ({ page }) => {
  const testCase = getAiUatCase("UAT-002");
  await executeCase(page, testCase, async () => {
    await page.goto(`${getPreviewUrl()}${testCase.startRoute}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expectCleanLoginDenial(page, "Anonymous Finance direct-open");
    await expect(page.getByText(/Finance queue|Accounts & Release/i)).toHaveCount(0);
    return "Anonymous Finance probe failed closed to the canonical Login route with no protected Finance content.";
  });
});

test("UAT-003 — session isolation Dispatch → Assembly", async ({ page }) => {
  const testCase = getAiUatCase("UAT-003");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH", "TEST_ASSEMBLY"])) return;
  await executeCase(page, testCase, async () => {
    await clickLogout(page);
    // UAT-001 owns logout-route quality. Recover to Login here only to continue the role-isolation proof.
    await page.waitForTimeout(2_800);
    if (!/\/login(?:$|\?|\/)/.test(new URL(page.url()).pathname)) {
      await page.goto(`${getPreviewUrl()}/login`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    }
    await loginWithPrefix(page, "TEST_ASSEMBLY");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Dispatch today", { exact: false })).toHaveCount(0);
    await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.getByText(/Production today/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    return `Assembly login replaced Dispatch session state and rendered the production role home at ${new URL(page.url()).pathname}.`;
  }, "TEST_DISPATCH");
});

test("UAT-004 — Dispatch Manager governed landing", async ({ page }) => {
  const testCase = getAiUatCase("UAT-004");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    await expect(page, "Dispatch must land on governed DispatchManagement").toHaveURL(/\/admin\/dispatch-mgmt\/?(?:$|\?)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Dispatch$/i })).toBeVisible();
    await expect(page.getByText(/Governed carton.*DPL authority/i)).toBeVisible();
    return "Dispatch landed on /admin/dispatch-mgmt with the governed carton/DPL workflow.";
  }, "TEST_DISPATCH");
});

test("UAT-005 — Dispatch Finance isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-005");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Finance navigation absent; direct probes: ${probes.join("; ")}`;
  }, "TEST_DISPATCH");
});

test("UAT-006 — Dispatch broad Admin Tools isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-006");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `All-tools least privilege verified; direct probes: ${probes.join("; ")}`;
  }, "TEST_DISPATCH");
});

test("UAT-007 — Dispatch CMD/Legacy War Room isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-007");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `CMD/Legacy War Room absent; direct probes: ${probes.join("; ")}`;
  }, "TEST_DISPATCH");
});

test("UAT-008 — governed B2B Dispatch visibility has rows or explicit empty state", async ({ page }) => {
  const testCase = getAiUatCase("UAT-008");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    await expect(page.getByText("Governed consignments", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[class*='animate-spin']").first()).toBeHidden({ timeout: 15_000 });
    const explicitEmpty = page.getByText("No governed consignments yet.", { exact: true });
    const table = page.getByRole("table");
    const hasEmpty = await explicitEmpty.isVisible().catch(() => false);
    const hasTable = await table.isVisible().catch(() => false);
    expect(hasEmpty || hasTable, "Dispatch results must render rows/table or an explicit empty state, never an unexplained blank panel").toBe(true);
    return hasEmpty ? "Governed Dispatch rendered an explicit empty state." : "Governed Dispatch rendered its consignment table.";
  }, "TEST_DISPATCH");
});

test("UAT-009 — Assembly cross-role isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-009");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_ASSEMBLY"])) return;
  await executeCase(page, testCase, async () => {
    await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.getByText(/Production today/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Assembly must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Assembly remained production-oriented; unrelated route probes: ${probes.join("; ")}`;
  }, "TEST_ASSEMBLY");
});

test("UAT-010 — hidden UI does not equal permission", async ({ page }) => {
  const testCase = getAiUatCase("UAT-010");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await executeCase(page, testCase, async () => {
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Every forbidden direct route failed closed: ${probes.join("; ")}`;
  }, "TEST_DISPATCH");
});