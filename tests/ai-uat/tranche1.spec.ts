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

// Credentials are entered with repo-wide Playwright tracing/video disabled.
// Sanitized evidence is captured explicitly after authentication only.
test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ mode: "serial" });

async function blockIfMissingCredentials(page: Page, testCase: AiUatCase, prefixes: Array<"TEST_DISPATCH" | "TEST_ASSEMBLY">) {
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
) {
  const diagnostics = attachSafeDiagnostics(page);
  const screenshots: string[] = [];
  try {
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
      actual: message,
      diagnostics,
      screenshots,
      severity: /UAT-00[1-7]|UAT-010/.test(testCase.id) ? "P0" : "P1",
    });
    throw error;
  }
}

async function loginDispatch(page: Page) {
  await loginWithPrefix(page, "TEST_DISPATCH");
  await page.waitForLoadState("domcontentloaded");
}

async function loginAssembly(page: Page) {
  await loginWithPrefix(page, "TEST_ASSEMBLY");
  await page.waitForLoadState("domcontentloaded");
}

test("UAT-001 — logout terminates access", async ({ page }) => {
  const testCase = getAiUatCase("UAT-001");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    await clickLogout(page);
    await expect(page, "Logout must reach the valid Login route without a 404 detour").toHaveURL(/\/login(?:$|\?|\/)/, { timeout: 8_000 });
    await expect(page.getByText(/404|page not found/i)).toHaveCount(0);
    await page.goto(`${getPreviewUrl()}/admin/dispatch-mgmt`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page, "Logged-out user must not regain Dispatch by direct URL").not.toHaveURL(/\/admin\/dispatch-mgmt(?:$|\?)/, { timeout: 8_000 });
    return "Logout reached Login and a direct Dispatch revisit remained unauthenticated.";
  });
});

test("UAT-002 — anonymous direct URL protection", async ({ page }) => {
  const testCase = getAiUatCase("UAT-002");
  await executeCase(page, testCase, async () => {
    await page.goto(`${getPreviewUrl()}${testCase.startRoute}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page, "Anonymous direct-open must not remain on Finance").not.toHaveURL(/\/admin\/finance(?:$|\?)/, { timeout: 8_000 });
    await expect(page.getByText(/Finance queue|Accounts & Release/i)).toHaveCount(0);
    return `Anonymous Finance probe failed closed to ${new URL(page.url()).pathname}.`;
  });
});

test("UAT-003 — session isolation Dispatch → Assembly", async ({ page }) => {
  const testCase = getAiUatCase("UAT-003");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH", "TEST_ASSEMBLY"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    await clickLogout(page);
    // UAT-001 separately owns logout-route quality. For session isolation, recover to Login if the current known 404 is encountered.
    await page.waitForTimeout(2_800);
    if (!/\/login(?:$|\?|\/)/.test(new URL(page.url()).pathname)) {
      await page.goto(`${getPreviewUrl()}/login`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    }
    await loginAssembly(page);
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Dispatch today", { exact: false })).toHaveCount(0);
    await expect(page.getByText(/Production today/i).first()).toBeVisible({ timeout: 15_000 });
    return `Assembly login replaced Dispatch session state at ${new URL(page.url()).pathname}.`;
  });
});

test("UAT-004 — Dispatch Manager governed landing", async ({ page }) => {
  const testCase = getAiUatCase("UAT-004");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    await expect(page, "Dispatch must land on governed DispatchManagement").toHaveURL(/\/admin\/dispatch-mgmt(?:$|\?)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Dispatch$/i })).toBeVisible();
    await expect(page.getByText(/Governed carton.*DPL authority/i)).toBeVisible();
    return "Dispatch landed on /admin/dispatch-mgmt with the governed carton/DPL workflow.";
  });
});

test("UAT-005 — Dispatch Finance isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-005");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Finance navigation absent; direct probes: ${probes.join("; ")}`;
  });
});

test("UAT-006 — Dispatch broad Admin Tools isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-006");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await executeCase(page, testCase, async () => {
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `All-tools least privilege verified; direct probes: ${probes.join("; ")}`;
  });
});

test("UAT-007 — Dispatch CMD/Legacy War Room isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-007");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await executeCase(page, testCase, async () => {
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `CMD/Legacy War Room absent; direct probes: ${probes.join("; ")}`;
  });
});

test("UAT-008 — governed B2B Dispatch visibility has rows or explicit empty state", async ({ page }) => {
  const testCase = getAiUatCase("UAT-008");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    await expect(page.getByText("Governed consignments", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[class*='animate-spin']").first()).toBeHidden({ timeout: 15_000 }).catch(() => {});
    const explicitEmpty = page.getByText("No governed consignments yet.", { exact: true });
    const table = page.getByRole("table");
    const hasEmpty = await explicitEmpty.isVisible().catch(() => false);
    const hasTable = await table.isVisible().catch(() => false);
    expect(hasEmpty || hasTable, "Dispatch results must render rows/table or an explicit empty state, never an unexplained blank panel").toBe(true);
    return hasEmpty ? "Governed Dispatch rendered an explicit empty state." : "Governed Dispatch rendered its consignment table.";
  });
});

test("UAT-009 — Assembly cross-role isolation", async ({ page }) => {
  const testCase = getAiUatCase("UAT-009");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_ASSEMBLY"])) return;
  await loginAssembly(page);
  await page.goto(`${getPreviewUrl()}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await executeCase(page, testCase, async () => {
    await expect(page.getByText(/Production today/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("DISPATCH MANAGER", { exact: false })).toHaveCount(0);
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Assembly must not be offered ${label}`).toHaveCount(0);
    }
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Assembly remained production-oriented; unrelated route probes: ${probes.join("; ")}`;
  });
});

test("UAT-010 — hidden UI does not equal permission", async ({ page }) => {
  const testCase = getAiUatCase("UAT-010");
  if (await blockIfMissingCredentials(page, testCase, ["TEST_DISPATCH"])) return;
  await loginDispatch(page);
  await executeCase(page, testCase, async () => {
    const probes = await probeForbiddenRoutes(page, testCase);
    return `Every forbidden direct route failed closed: ${probes.join("; ")}`;
  });
});
