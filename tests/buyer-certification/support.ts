import { expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

export type BuyerCertificationViewport = {
  name: "mobile-375" | "mobile-390" | "mobile-430";
  width: number;
  height: number;
};

export const BUYER_GOLDEN_PATH_VIEWPORTS: BuyerCertificationViewport[] = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
];

export type BuyerGoldenPathEvidence = {
  schema_version: 1;
  status: "PASS" | "FAIL";
  commit_sha: string;
  environment_id: string;
  preview_url: string;
  supabase_url: string;
  fixture_email: string;
  fixture_id: string | null;
  viewport: BuyerCertificationViewport["name"];
  auth_method: "ephemeral_local_gotrue_password_session_not_msg91";
  steps: Array<{ step: string; status: "PASS" | "FAIL"; detail?: string }>;
  screenshot_paths: string[];
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function assertSafePreviewHost(hostname: string): void {
  if (process.env.BUYER_CERT_ALLOW_REMOTE_PREVIEW === "true") {
    if (hostname.endsWith(".vercel.app")) return;
    throw new Error(`Remote preview host ${hostname} is not an approved *.vercel.app preview`);
  }
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(`Buyer certification preview host ${hostname} must be loopback unless BUYER_CERT_ALLOW_REMOTE_PREVIEW=true`);
  }
}

export function resolveBuyerCertificationTarget(): string {
  const raw = process.env.TEST_PREVIEW_URL?.trim();
  if (!raw) throw new Error("CERTIFICATION_ENV_REQUIRED: TEST_PREVIEW_URL is missing");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`UNSAFE_CERTIFICATION_TARGET: TEST_PREVIEW_URL protocol ${url.protocol}`);
  }
  assertSafePreviewHost(url.hostname);
  return raw.replace(/\/$/, "");
}

export function requireBuyerCredentials(): { email: string; password: string } {
  const email = process.env.TEST_BUYER_EMAIL?.trim();
  const password = process.env.TEST_BUYER_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("CREDENTIAL_REQUIRED: TEST_BUYER_EMAIL and TEST_BUYER_PASSWORD are required");
  }
  return { email, password };
}

/**
 * Browser-only synthetic authentication against a disposable local GoTrue.
 * This is NOT MSG91 OTP, phone possession, mobile APK or production UAT.
 * The user role and company must still pass the app's normal server-backed gate.
 */
export async function loginBuyer(page: Page, email: string, password: string, targetUrl: string) {
  const apiUrl = process.env.BUYER_CERT_SUPABASE_URL?.trim();
  const anonKey = process.env.BUYER_CERT_SUPABASE_ANON_KEY?.trim();
  const expectedId = process.env.BUYER_CERT_SYNTHETIC_FIXTURE_ID?.trim();
  if (!apiUrl || !anonKey || !expectedId) {
    throw new Error("CERTIFICATION_ENV_REQUIRED: local GoTrue URL, anon key and fixture ID are required");
  }
  const appSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  if (!appSupabaseUrl) throw new Error("CERTIFICATION_ENV_REQUIRED: app Supabase URL is required");
  const authHost = new URL(apiUrl).hostname;
  const appHost = new URL(appSupabaseUrl).hostname;
  const previewHost = new URL(targetUrl).hostname;
  if (!LOOPBACK_HOSTS.has(authHost) || !LOOPBACK_HOSTS.has(appHost) || !LOOPBACK_HOSTS.has(previewHost)) {
    throw new Error("CERTIFICATION_LOOPBACK_ONLY: synthetic password sessions cannot be used against remote services");
  }

  // This is a real GoTrue session for the local fixture, not a forged JWT,
  // mocked browser login, auth bypass or a claim of MSG91 OTP verification.
  const response = await page.request.post(`${apiUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, "content-type": "application/json" },
    data: { email, password },
  });
  if (response.status() !== 200) {
    throw new Error(`CERTIFICATION_AUTH_FAILED: local GoTrue returned HTTP ${response.status()}`);
  }
  const session = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    token_type?: unknown;
    expires_in?: unknown;
    user?: { id?: unknown; email?: unknown };
  };
  if (typeof session.access_token !== "string" || !session.access_token ||
      typeof session.refresh_token !== "string" || !session.refresh_token ||
      session.user?.id !== expectedId || session.user?.email !== email) {
    throw new Error("CERTIFICATION_AUTH_MISMATCH: session does not belong to the disposable Buyer fixture");
  }

  // Set the real session once, before opening the protected app. Do NOT use
  // addInitScript: it would silently restore the token again after logout.
  const storageKey = `sb-${appHost.split(".")[0]}-auth-token`;
  await page.goto(`${targetUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, {
    key: storageKey,
    value: { ...session, expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600) },
  });
  await page.goto(`${targetUrl}/buyer`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator("#dashboard-heading")).toBeVisible({ timeout: 60_000 });
}

export async function runBuyerGoldenPath(
  page: Page,
  targetUrl: string,
  viewport: BuyerCertificationViewport,
): Promise<BuyerGoldenPathEvidence> {
  const credentials = requireBuyerCredentials();
  const evidence: BuyerGoldenPathEvidence = {
    schema_version: 1,
    status: "PASS",
    commit_sha: process.env.BUYER_CERT_COMMIT_SHA?.trim() || "unknown",
    environment_id: process.env.BUYER_CERT_ENVIRONMENT_ID?.trim() || "buyer-cert-local",
    preview_url: targetUrl,
    supabase_url: process.env.BUYER_CERT_SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "unknown",
    fixture_email: credentials.email,
    fixture_id: process.env.BUYER_CERT_SYNTHETIC_FIXTURE_ID?.trim() || null,
    viewport: viewport.name,
    auth_method: "ephemeral_local_gotrue_password_session_not_msg91",
    steps: [],
    screenshot_paths: [],
  };

  const record = (step: string, status: "PASS" | "FAIL", detail?: string) => {
    evidence.steps.push({ step, status, detail });
    if (status === "FAIL") evidence.status = "FAIL";
  };

  const shot = async (label: string) => {
    const path = `buyer-certification-artifacts/${viewport.name}-${label}.png`;
    await page.screenshot({ path, fullPage: true });
    evidence.screenshot_paths.push(path);
  };

  try {
    await loginBuyer(page, credentials.email, credentials.password, targetUrl);
    record("login", "PASS", "real disposable GoTrue session; not MSG91 delivery, OTP or Android authentication");

    await page.goto(`${targetUrl}/buyer`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#dashboard-heading")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Welcome back")).toBeVisible({ timeout: 30_000 });
    await shot("01-dashboard");
    record("dashboard", "PASS");

    await page.goto(`${targetUrl}/buyer/catalogue`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Catalogue$/i })).toBeVisible({ timeout: 60_000 });
    const productView = page.getByRole("button", { name: /View Synthetic Certification Baklawa/i }).first();
    await expect(productView).toBeVisible({ timeout: 60_000 });
    await productView.click();
    await expect(page.getByRole("heading", { name: /Synthetic Certification Baklawa/i })).toBeVisible({ timeout: 30_000 });
    await shot("02-product-detail");
    record("product_detail", "PASS");

    await page.getByRole("button", { name: /Buy now/i }).click();
    await page.waitForURL((url) => /\/buyer\/cart/.test(url.pathname), { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Your cart/i })).toBeVisible({ timeout: 60_000 });
    await shot("03-cart");
    record("cart", "PASS");

    // Finance consent is mandatory: wait for the actual Core quote rather
    // than bypassing quotation via a legacy direct-order submit.
    await expect(page.getByText("Sales order value (incl. GST)")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Required advance", { exact: true })).toBeVisible({ timeout: 30_000 });
    const approval = page.getByRole("checkbox", { name: /I approve this Core quotation/i });
    await expect(approval).toBeEnabled({ timeout: 120_000 });
    await approval.check();
    const submit = page.getByRole("button", { name: /^Submit approved quotation$/i });
    await expect(submit).toBeEnabled({ timeout: 120_000 });
    await submit.click();
    await page.waitForURL((url) => /\/buyer\/orders\//.test(url.pathname), { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: /Order details/i })).toBeVisible({ timeout: 60_000 });
    await shot("04-order-detail");
    record("checkout_submit_order_detail", "PASS");

    await page.goto(`${targetUrl}/buyer/documents`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Documents$/i })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/SO-CERT-PRESEED-001|Sales order reference/i).first()).toBeVisible({ timeout: 60_000 });
    const statementFacts = page.getByLabel("Statement facts");
    if (await statementFacts.isVisible().catch(() => false)) {
      record("documents_statement", "PASS", "statement_facts_visible");
    } else {
      await expect(page.getByText(/Statement facts are available below|Statement/i).first()).toBeVisible({ timeout: 30_000 });
      record("documents_statement", "PASS", "statement_card_visible");
    }
    await shot("05-documents");
    record("documents", "PASS");

    await page.goto(`${targetUrl}/buyer/support`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Support$/i })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /^Communication log$/i })).toBeVisible({ timeout: 60_000 });
    await shot("06-communication-log");
    record("communication_log", "PASS");

    await page.goto(`${targetUrl}/buyer/account`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Account$/i })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: /^Sign out$/i }).click();
    await page.waitForURL((url) => /\/login/.test(url.pathname), { timeout: 60_000 });
    await shot("07-logout");
    record("logout", "PASS");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!evidence.steps.some((step) => step.status === "FAIL")) {
      record("golden_path", "FAIL", message);
    }
    await shot("failure").catch(() => undefined);
    return evidence;
  }

  return evidence;
}

export function writeGoldenPathEvidence(evidence: BuyerGoldenPathEvidence, outputPath = "buyer-golden-path-evidence.json") {
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
