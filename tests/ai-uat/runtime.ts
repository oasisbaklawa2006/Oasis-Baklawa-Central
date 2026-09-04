import fs from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import type { AiUatCase, AiUatStatus } from "../../src/lib/ai-uat/catalogue";
import { getPreviewUrl, login } from "../e2e-helpers";
import {
  aiPlannerEnabled,
  requestAiPlannerAction,
  type AiPlannerAction,
  type AiPlannerHistoryEntry,
} from "./planner";

const EVIDENCE_DIR = path.join(process.cwd(), "test-results", "ai-uat-evidence");
const MUTATION_LABEL = /\b(create|submit|approve|reject|delete|remove|upload|record|lock|open carton|reserve|issue|finalize|release|save|send|confirm|supersede|pay|refund|grant|revoke)\b/i;
const SAFE_FILL_LABEL = /\b(search|filter|find)\b/i;
const SAFE_NAV_BUTTON_LABEL = /\b(open navigation|all tools|menu|close|expand|collapse|back|next|previous|filter|search|refresh|view|details?|tab)\b/i;

export type AiUatEvidence = {
  uat_id: string;
  status: AiUatStatus;
  role: string;
  viewport: { width: number; height: number } | null;
  start_url: string;
  final_url: string;
  actions: AiPlannerHistoryEntry[];
  expected: string;
  actual: string;
  console_errors: string[];
  failed_requests: Array<{ url: string; status: number }>;
  screenshots: string[];
  failure_step: number | null;
  severity: "P0" | "P1" | "P2" | "INFO";
  reproduction_steps: string[];
  generated_at: string;
};

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "<phone>")
    .replace(/\b\d{12,}\b/g, "<long-number>");
}

function safeAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

function normalizePathname(value: string): string {
  if (!value) return "/";
  const pathOnly = value.split(/[?#]/, 1)[0] || "/";
  const stripped = pathOnly.replace(/\/+$/, "");
  return stripped || "/";
}

function previewOrigin(): string {
  return new URL(getPreviewUrl()).origin;
}

function boundedPaths(testCase: AiUatCase): Set<string> {
  return new Set(
    [...testCase.allowedRoutes, ...testCase.forbiddenRoutes, testCase.startRoute].map(normalizePathname),
  );
}

function safeDeniedDestinations(testCase: AiUatCase): Set<string> {
  return new Set(
    [
      ...testCase.allowedRoutes,
      testCase.startRoute,
      "/login",
      "/splash",
      "/customer-app-redirect",
      "/buyer",
      "/",
    ].map(normalizePathname),
  );
}

export function hasRoleCredentials(prefix: "TEST_DISPATCH" | "TEST_ASSEMBLY"): boolean {
  return Boolean(process.env[`${prefix}_EMAIL`]?.trim() && process.env[`${prefix}_PASSWORD`]?.trim());
}

export async function loginWithPrefix(page: Page, prefix: "TEST_DISPATCH" | "TEST_ASSEMBLY") {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  if (!email || !password) throw new Error(`${prefix}_EMAIL and ${prefix}_PASSWORD are required for this UAT case.`);
  await login(page, email, password);
}

export function attachSafeDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ url: string; status: number }> = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error") consoleErrors.push(redact(message.text()).slice(0, 500));
  };
  const onResponse = (response: { status: () => number; url: () => string; request: () => { resourceType: () => string } }) => {
    const status = response.status();
    const type = response.request().resourceType();
    if (status >= 400 && ["document", "xhr", "fetch", "script", "stylesheet"].includes(type)) {
      failedRequests.push({ url: safeAbsoluteUrl(response.url()).slice(0, 250), status });
    }
  };
  page.on("console", onConsole);
  page.on("response", onResponse);
  return {
    consoleErrors,
    failedRequests,
    detach() {
      page.off("console", onConsole);
      page.off("response", onResponse);
    },
  };
}

export async function safeEvidenceScreenshot(page: Page, testCase: AiUatCase, label: string): Promise<string | null> {
  if (process.env.AI_UAT_CAPTURE_IMAGES !== "true") return null;
  if (process.env.AI_UAT_SYNTHETIC_TARGET !== "true") {
    throw new Error("AI_UAT_CAPTURE_IMAGES=true requires AI_UAT_SYNTHETIC_TARGET=true; raw live-business screenshots must not be uploaded from this public repo workflow.");
  }
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const fileName = `${testCase.id.toLowerCase()}-${label.replace(/[^a-z0-9_-]+/gi, "-")}.png`;
  const out = path.resolve(EVIDENCE_DIR, fileName);
  const evidenceRoot = `${path.resolve(EVIDENCE_DIR)}${path.sep}`;
  if (!out.startsWith(evidenceRoot)) throw new Error("AI-UAT screenshot path escaped the evidence directory.");
  await page.screenshot({ path: out, fullPage: true });
  return path.relative(process.cwd(), out).split(path.sep).join("/");
}

type ResolvedClickable = {
  locator: Locator;
  label: string;
  tag: "button" | "link";
  href: string | null;
  buttonType: string | null;
  ariaExpanded: string | null;
  ariaControls: string | null;
};

async function describeClickable(locator: Locator, tag: "button" | "link"): Promise<ResolvedClickable> {
  const details = await locator.evaluate((element) => ({
    label: (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim(),
    href: element instanceof HTMLAnchorElement ? element.href : null,
    buttonType: element instanceof HTMLButtonElement ? element.type : null,
    ariaExpanded: element.getAttribute("aria-expanded"),
    ariaControls: element.getAttribute("aria-controls"),
  }));
  return { locator, tag, ...details };
}

async function findClickable(page: Page, target: string): Promise<ResolvedClickable | null> {
  const button = page.getByRole("button", { name: target, exact: true }).first();
  if ((await button.count().catch(() => 0)) > 0 && (await button.isVisible().catch(() => false))) {
    return describeClickable(button, "button");
  }
  const link = page.getByRole("link", { name: target, exact: true }).first();
  if ((await link.count().catch(() => 0)) > 0 && (await link.isVisible().catch(() => false))) {
    return describeClickable(link, "link");
  }
  return null;
}

function assertSamePreviewOrigin(urlValue: string, context: string): URL {
  const url = new URL(urlValue);
  if (url.origin !== previewOrigin()) {
    throw new Error(`${context} attempted to leave the approved preview origin.`);
  }
  return url;
}

async function executePlannerAction(page: Page, testCase: AiUatCase, action: AiPlannerAction): Promise<void> {
  switch (action.action) {
    case "click": {
      if (!action.target) throw new Error("AI click action requires target.");
      const resolved = await findClickable(page, action.target);
      if (!resolved) throw new Error(`AI click target not found as an exact visible button/link: ${action.target}`);
      if (MUTATION_LABEL.test(resolved.label)) {
        throw new Error(`AI planner mutation-like resolved control blocked by policy: ${resolved.label}`);
      }

      const paths = boundedPaths(testCase);
      if (resolved.tag === "link") {
        if (!resolved.href) throw new Error("AI link target has no href.");
        const url = assertSamePreviewOrigin(resolved.href, "AI link click");
        if (!paths.has(normalizePathname(url.pathname))) {
          throw new Error(`AI link navigation outside case route boundary blocked: ${url.pathname}`);
        }
      } else {
        if (resolved.buttonType === "submit") throw new Error(`AI submit-button click blocked: ${resolved.label}`);
        const isDisclosure = resolved.ariaExpanded !== null || resolved.ariaControls !== null;
        if (!isDisclosure && !SAFE_NAV_BUTTON_LABEL.test(resolved.label)) {
          throw new Error(`AI button click is not an approved navigation/disclosure control: ${resolved.label}`);
        }
      }

      const before = new URL(page.url());
      await resolved.locator.click({ timeout: 10_000 });
      const after = new URL(page.url());
      if (after.origin !== previewOrigin()) {
        await page.goto(`${getPreviewUrl()}${testCase.startRoute}`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
        throw new Error("AI click left the approved preview origin and was recovered to the case start route.");
      }
      if (normalizePathname(after.pathname) !== normalizePathname(before.pathname) && !paths.has(normalizePathname(after.pathname))) {
        throw new Error(`AI click navigated outside the case route boundary: ${after.pathname}`);
      }
      return;
    }
    case "fill": {
      if (!action.target || action.value === null) throw new Error("AI fill action requires target and value.");
      const input = page.getByLabel(action.target, { exact: true }).or(page.getByPlaceholder(action.target, { exact: true })).first();
      await expect(input).toBeVisible({ timeout: 10_000 });
      const descriptor = await input.evaluate((element) =>
        (element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.getAttribute("name") || "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      if (!SAFE_FILL_LABEL.test(descriptor)) throw new Error(`AI fill blocked outside resolved search/filter controls: ${descriptor}`);
      await input.fill(action.value, { timeout: 10_000 });
      return;
    }
    case "scroll":
      await page.mouse.wheel(0, action.direction === "up" ? -650 : 650);
      return;
    case "back": {
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
      if (new URL(page.url()).origin !== previewOrigin()) {
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
        throw new Error("AI back navigation would leave the approved preview origin.");
      }
      return;
    }
    case "wait":
      await page.waitForTimeout(900);
      return;
    case "navigate": {
      if (!action.target) throw new Error("AI navigate action requires a route target.");
      if (!action.target.startsWith("/") || action.target.startsWith("//")) throw new Error(`AI external/invalid navigation blocked: ${action.target}`);
      const paths = boundedPaths(testCase);
      if (!paths.has(normalizePathname(action.target))) throw new Error(`AI navigation outside case route boundary blocked: ${action.target}`);
      await page.goto(`${getPreviewUrl()}${action.target}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      assertSamePreviewOrigin(page.url(), "AI bounded navigation");
      return;
    }
    case "screenshot":
      await safeEvidenceScreenshot(page, testCase, `ai-step-${Date.now()}`);
      return;
    case "finish":
      return;
  }
}

export async function runBoundedAiExploration(page: Page, testCase: AiUatCase): Promise<AiPlannerHistoryEntry[]> {
  if (!aiPlannerEnabled()) return [];
  const maxSteps = Math.min(Math.max(Number(process.env.AI_UAT_MAX_STEPS ?? 7) || 7, 1), 12);
  const history: AiPlannerHistoryEntry[] = [];

  for (let step = 1; step <= maxSteps; step++) {
    const urlBefore = safeAbsoluteUrl(page.url());
    const action = await requestAiPlannerAction({ page, testCase, history });
    const entry: AiPlannerHistoryEntry = { step, action, urlBefore };
    history.push(entry);
    if (action.action === "finish") break;
    try {
      await executePlannerAction(page, testCase, action);
      entry.urlAfter = safeAbsoluteUrl(page.url());
    } catch (error) {
      entry.error = redact(error instanceof Error ? error.message : String(error));
      break;
    }
  }
  return history;
}

export async function openAllTools(page: Page) {
  const openNavigation = page.getByRole("button", { name: /open navigation/i });
  if (await openNavigation.isVisible().catch(() => false)) await openNavigation.click();
  const allTools = page.getByRole("button", { name: /all tools/i });
  await expect(allTools).toBeVisible({ timeout: 15_000 });
  const expanded = await allTools.getAttribute("aria-expanded");
  if (expanded !== "true") await allTools.click();
  return page.getByRole("navigation", { name: /all permitted tools/i });
}

export async function clickLogout(page: Page) {
  const openNavigation = page.getByRole("button", { name: /open navigation/i });
  if (await openNavigation.isVisible().catch(() => false)) await openNavigation.click();
  const logout = page.getByRole("button", { name: /logout/i }).or(page.getByRole("link", { name: /logout/i })).first();
  await expect(logout).toBeVisible({ timeout: 15_000 });
  await logout.click();
}

export async function probeForbiddenRoutes(page: Page, testCase: AiUatCase): Promise<string[]> {
  const results: string[] = [];
  const deniedDestinations = safeDeniedDestinations(testCase);
  for (const route of testCase.forbiddenRoutes) {
    await page.goto(`${getPreviewUrl()}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(350);
    const finalUrl = assertSamePreviewOrigin(page.url(), `${testCase.id} forbidden-route probe`);
    const requestedPath = normalizePathname(route);
    const finalPath = normalizePathname(finalUrl.pathname);
    results.push(`${requestedPath} -> ${finalPath}`);
    expect(finalPath, `${testCase.id}: ${route} must not remain on the forbidden route`).not.toBe(requestedPath);
    expect(
      deniedDestinations.has(finalPath),
      `${testCase.id}: ${route} must redirect to a known permitted/auth-safe destination, got ${finalPath}`,
    ).toBe(true);
  }
  return results;
}

function sanitizedActions(actions: AiPlannerHistoryEntry[]): AiPlannerHistoryEntry[] {
  return actions.map((entry) => ({
    ...entry,
    urlBefore: safeAbsoluteUrl(entry.urlBefore),
    ...(entry.urlAfter ? { urlAfter: safeAbsoluteUrl(entry.urlAfter) } : {}),
    ...(entry.error ? { error: redact(entry.error) } : {}),
  }));
}

function evidenceFilePath(id: string): string {
  const safeId = id.toLowerCase();
  if (!/^uat-(00[1-9]|010)$/.test(safeId)) throw new Error(`Unsupported AI-UAT evidence id: ${id}`);
  const out = path.resolve(EVIDENCE_DIR, `${safeId}.json`);
  const evidenceRoot = `${path.resolve(EVIDENCE_DIR)}${path.sep}`;
  if (!out.startsWith(evidenceRoot)) throw new Error("AI-UAT evidence path escaped the evidence directory.");
  return out;
}

export async function writeEvidence(args: {
  page: Page;
  testCase: AiUatCase;
  status: AiUatStatus;
  actions?: AiPlannerHistoryEntry[];
  actual: string;
  diagnostics?: { consoleErrors: string[]; failedRequests: Array<{ url: string; status: number }> };
  screenshots?: string[];
  severity?: AiUatEvidence["severity"];
  reproductionSteps?: string[];
  failureStep?: number | null;
}) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const viewport = args.page.viewportSize();
  const evidence: AiUatEvidence = {
    uat_id: args.testCase.id,
    status: args.status,
    role: args.testCase.actor,
    viewport,
    start_url: args.testCase.startRoute,
    final_url: safeAbsoluteUrl(args.page.url()),
    actions: sanitizedActions(args.actions ?? []),
    expected: args.testCase.deterministicOracle,
    actual: redact(args.actual),
    console_errors: (args.diagnostics?.consoleErrors ?? []).map(redact),
    failed_requests: (args.diagnostics?.failedRequests ?? []).map((entry) => ({
      url: safeAbsoluteUrl(entry.url),
      status: entry.status,
    })),
    screenshots: args.screenshots ?? [],
    failure_step: args.failureStep ?? null,
    severity: args.severity ?? "P1",
    reproduction_steps: (args.reproductionSteps ?? []).map(redact),
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(evidenceFilePath(args.testCase.id), JSON.stringify(evidence, null, 2), "utf8");
  return evidence;
}
