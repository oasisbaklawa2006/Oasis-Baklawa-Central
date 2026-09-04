import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import type { AiUatCase, AiUatStatus } from "../../src/lib/ai-uat/catalogue";
import { getPreviewUrl, login } from "../e2e-helpers";
import {
  aiPlannerEnabled,
  requestAiPlannerAction,
  type AiPlannerAction,
  type AiPlannerHistoryEntry,
} from "./planner";

const EVIDENCE_DIR = path.join(process.cwd(), "test-results", "ai-uat-evidence");
const MUTATION_LABEL = /\b(create|submit|approve|reject|delete|remove|upload|record|lock|open carton|reserve|issue|finalize|release|save|send|confirm|supersede)\b/i;
const SAFE_FILL_LABEL = /\b(search|filter|find)\b/i;

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
      failedRequests.push({ url: redact(response.url()).slice(0, 250), status });
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
  const out = path.join(EVIDENCE_DIR, fileName);
  await page.screenshot({ path: out, fullPage: true });
  return path.relative(process.cwd(), out).split(path.sep).join("/");
}

async function findClickable(page: Page, target: string) {
  const candidates = [
    page.getByRole("button", { name: target, exact: false }),
    page.getByRole("link", { name: target, exact: false }),
    page.getByText(target, { exact: false }),
    page.locator(`[aria-label*=${JSON.stringify(target)}]`),
  ];
  for (const locator of candidates) {
    if ((await locator.count().catch(() => 0)) > 0 && (await locator.first().isVisible().catch(() => false))) {
      return locator.first();
    }
  }
  return null;
}

async function executePlannerAction(page: Page, testCase: AiUatCase, action: AiPlannerAction): Promise<void> {
  switch (action.action) {
    case "click": {
      if (!action.target) throw new Error("AI click action requires target.");
      if (MUTATION_LABEL.test(action.target)) {
        throw new Error(`AI planner mutation-like click blocked by policy: ${action.target}`);
      }
      const locator = await findClickable(page, action.target);
      if (!locator) throw new Error(`AI click target not found: ${action.target}`);
      await locator.click({ timeout: 10_000 });
      return;
    }
    case "fill": {
      if (!action.target || action.value === null) throw new Error("AI fill action requires target and value.");
      if (!SAFE_FILL_LABEL.test(action.target)) throw new Error(`AI fill blocked outside search/filter controls: ${action.target}`);
      const input = page.getByLabel(action.target, { exact: false }).or(page.getByPlaceholder(action.target, { exact: false })).first();
      await input.fill(action.value, { timeout: 10_000 });
      return;
    }
    case "scroll":
      await page.mouse.wheel(0, action.direction === "up" ? -650 : 650);
      return;
    case "back":
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
      return;
    case "wait":
      await page.waitForTimeout(900);
      return;
    case "navigate": {
      if (!action.target) throw new Error("AI navigate action requires a route target.");
      if (!action.target.startsWith("/") || action.target.startsWith("//")) throw new Error(`AI external/invalid navigation blocked: ${action.target}`);
      const boundedRoutes = new Set([...testCase.allowedRoutes, ...testCase.forbiddenRoutes, testCase.startRoute]);
      if (!boundedRoutes.has(action.target)) throw new Error(`AI navigation outside case route boundary blocked: ${action.target}`);
      await page.goto(`${getPreviewUrl()}${action.target}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
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
    const urlBefore = page.url();
    const action = await requestAiPlannerAction({ page, testCase, history });
    const entry: AiPlannerHistoryEntry = { step, action, urlBefore };
    history.push(entry);
    if (action.action === "finish") break;
    try {
      await executePlannerAction(page, testCase, action);
      entry.urlAfter = page.url();
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
  for (const route of testCase.forbiddenRoutes) {
    await page.goto(`${getPreviewUrl()}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(350);
    const finalPath = new URL(page.url()).pathname;
    results.push(`${route} -> ${finalPath}`);
    expect(finalPath, `${testCase.id}: ${route} must fail closed`).not.toBe(route);
  }
  return results;
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
    final_url: redact(args.page.url()),
    actions: args.actions ?? [],
    expected: args.testCase.deterministicOracle,
    actual: redact(args.actual),
    console_errors: (args.diagnostics?.consoleErrors ?? []).map(redact),
    failed_requests: args.diagnostics?.failedRequests ?? [],
    screenshots: args.screenshots ?? [],
    failure_step: args.failureStep ?? null,
    severity: args.severity ?? "P1",
    reproduction_steps: args.reproductionSteps ?? [],
    generated_at: new Date().toISOString(),
  };
  const out = path.join(EVIDENCE_DIR, `${args.testCase.id.toLowerCase()}.json`);
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
  return evidence;
}
