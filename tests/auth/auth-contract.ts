import { expect, type Locator, type Page } from "@playwright/test";
import { getPreviewUrl } from "../e2e-helpers";

/** Canonical block / disposition labels for UAT evidence (must stay consistent across manifests + scripts). */
export const AUTH_BLOCK_CLASSIFICATIONS = {
  MISSING_SECRET: "MISSING_SECRET",
  AUTH_FLOW_FAILED: "AUTH_FLOW_FAILED",
  AUTH_CONTRACT_MISMATCH: "AUTH_CONTRACT_MISMATCH",
  PROVIDER_GATED: "PROVIDER_GATED",
  OTP_EXTERNAL_GATE: "OTP_EXTERNAL_GATE",
  APPLICATION_FAIL: "APPLICATION_FAIL",
  NOT_EXECUTED: "NOT_EXECUTED",
  DEPLOYMENT_PROTECTION: "DEPLOYMENT_PROTECTION",
} as const;

export type AuthBlockClassification =
  (typeof AUTH_BLOCK_CLASSIFICATIONS)[keyof typeof AUTH_BLOCK_CLASSIFICATIONS];

export type AuthArchitecture = "split" | "legacy";

export type UatAuthRoleKind = "staff" | "buyer";

export type LoginAttemptResult =
  | { ok: true; architecture: AuthArchitecture; path: string }
  | {
      ok: false;
      architecture: AuthArchitecture;
      path: string;
      classification: AuthBlockClassification;
      message: string;
    };

const BUYER_PERSONAS = new Set([
  "BUYER",
  "B2B_BUYER",
  "SPECIAL_BUYER",
  "HORECA_BUYER",
  "WHOLESALE_BUYER",
  "BULK_BUYER",
  "CLIENT",
  "CUSTOMER_USER",
]);

const STAFF_LOGIN_PATH = "/staff/login";
const BUYER_LOGIN_PATH = "/buyer/login";
const LEGACY_LOGIN_PATH = "/login";
const AUTH_ENTRY_HEADING = /Everything you need from Oasis Baklawa/i;
const LEGACY_HEADING = /Welcome Back/i;
const STAFF_HEADING = /Employee Access/i;
const BUYER_HEADING = /B2B Client Login/i;

export function authKindForPersona(persona: string): UatAuthRoleKind {
  return BUYER_PERSONAS.has(persona) ? "buyer" : "staff";
}

export function staffLoginPath(): string {
  return STAFF_LOGIN_PATH;
}

export function buyerLoginPath(): string {
  return BUYER_LOGIN_PATH;
}

export function isUnauthenticatedDestination(pathname: string): boolean {
  return (
    /^\/login(?:\/|$|\?)/.test(pathname) ||
    /^\/staff\/login(?:\/|$|\?)/.test(pathname) ||
    /^\/buyer\/login(?:\/|$|\?)/.test(pathname) ||
    pathname === "/splash"
  );
}

async function waitForVisible(locator: Locator, timeout = 15_000): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

export async function waitForUnauthenticatedDestination(page: Page, timeout = 15_000): Promise<string> {
  await page.waitForURL((url) => isUnauthenticatedDestination(url.pathname), { timeout });
  return new URL(page.url()).pathname;
}

export async function detectAuthArchitecture(page: Page): Promise<AuthArchitecture> {
  await page.goto(`${getPreviewUrl()}${LEGACY_LOGIN_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // React mounts after DOMContentLoaded. Wait for the first auth heading rather
  // than sampling lazy/eager route state synchronously.
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  if (await page.getByRole("heading", { name: LEGACY_HEADING }).isVisible().catch(() => false)) {
    return "legacy";
  }
  if (await page.getByRole("heading", { name: AUTH_ENTRY_HEADING }).isVisible().catch(() => false)) {
    return "split";
  }

  await page.goto(`${getPreviewUrl()}${STAFF_LOGIN_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // StaffLogin is React.lazy() in App.tsx, so DOMContentLoaded can occur while
  // Suspense still renders the auth spinner. A stable form id is a stronger
  // readiness marker than an immediate heading snapshot.
  if (await waitForVisible(page.locator("#staff-email"), 15_000)) {
    return "split";
  }
  return "legacy";
}

function hasLeftLoginPath(pathname: string, fromPath: string): boolean {
  if (fromPath === STAFF_LOGIN_PATH) return !/^\/staff\/login(\/|$|\?)/.test(pathname);
  if (fromPath === BUYER_LOGIN_PATH) return !/^\/buyer\/login(\/|$|\?)/.test(pathname);
  return !/^\/login(\/|$|\?)/.test(pathname);
}

async function waitForAuthenticatedNavigation(page: Page, fromPath: string) {
  await page.waitForURL((url) => hasLeftLoginPath(url.pathname, fromPath), { timeout: 120_000 });
}

export async function loginStaff(page: Page, email: string, password: string): Promise<LoginAttemptResult> {
  const architecture = await detectAuthArchitecture(page);

  if (architecture === "split") {
    await page.goto(`${getPreviewUrl()}${STAFF_LOGIN_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const emailInput = page.locator("#staff-email");
    const passwordInput = page.locator("#staff-password");
    const staffReady =
      (await waitForVisible(emailInput, 15_000)) &&
      (await waitForVisible(passwordInput, 5_000)) &&
      (await waitForVisible(page.getByRole("button", { name: /^Login$/i }), 5_000));
    if (!staffReady) {
      const heading = await page.locator("h1").first().textContent().catch(() => null);
      return {
        ok: false,
        architecture,
        path: STAFF_LOGIN_PATH,
        classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_CONTRACT_MISMATCH,
        message: `Staff login form did not become ready after lazy-route load (heading=${heading ?? "none"})`,
      };
    }
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page.getByRole("button", { name: /^Login$/i }).click();
    try {
      await waitForAuthenticatedNavigation(page, STAFF_LOGIN_PATH);
      return { ok: true, architecture, path: STAFF_LOGIN_PATH };
    } catch (error) {
      return {
        ok: false,
        architecture,
        path: STAFF_LOGIN_PATH,
        classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_FLOW_FAILED,
        message: error instanceof Error ? error.message.slice(0, 300) : String(error),
      };
    }
  }

  await page.goto(`${getPreviewUrl()}${LEGACY_LOGIN_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const legacyVisible = await page.getByRole("heading", { name: LEGACY_HEADING }).isVisible().catch(() => false);
  if (!legacyVisible) {
    return {
      ok: false,
      architecture,
      path: LEGACY_LOGIN_PATH,
      classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_CONTRACT_MISMATCH,
      message: "Legacy unified login heading not found — application auth contract changed",
    };
  }
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  try {
    await waitForAuthenticatedNavigation(page, LEGACY_LOGIN_PATH);
    return { ok: true, architecture, path: LEGACY_LOGIN_PATH };
  } catch (error) {
    return {
      ok: false,
      architecture,
      path: LEGACY_LOGIN_PATH,
      classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_FLOW_FAILED,
      message: error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
}

export async function loginBuyer(page: Page, email: string, _password: string): Promise<LoginAttemptResult> {
  const architecture = await detectAuthArchitecture(page);

  if (architecture === "split") {
    await page.goto(`${getPreviewUrl()}${BUYER_LOGIN_PATH}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const onBuyerLogin = await waitForVisible(page.getByRole("heading", { name: BUYER_HEADING }), 15_000);
    if (!onBuyerLogin) {
      return {
        ok: false,
        architecture,
        path: BUYER_LOGIN_PATH,
        classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_CONTRACT_MISMATCH,
        message: "Buyer login surface missing B2B Client Login heading at /buyer/login",
      };
    }
    const otpGateVisible =
      (await page.getByText(/Mobile OTP/i).isVisible().catch(() => false)) ||
      (await page.getByText(/Email OTP/i).isVisible().catch(() => false)) ||
      (await page.getByText(/MSG91/i).isVisible().catch(() => false));
    if (otpGateVisible) {
      return {
        ok: false,
        architecture,
        path: BUYER_LOGIN_PATH,
        classification: AUTH_BLOCK_CLASSIFICATIONS.OTP_EXTERNAL_GATE,
        message:
          "Buyer authentication requires governed MSG91 OTP — browser automation cannot invent or bypass provider OTP",
      };
    }
    return {
      ok: false,
      architecture,
      path: BUYER_LOGIN_PATH,
      classification: AUTH_BLOCK_CLASSIFICATIONS.PROVIDER_GATED,
      message: "Buyer login requires MSG91 provider channel selection — not credential password login",
    };
  }

  await page.goto(`${getPreviewUrl()}${LEGACY_LOGIN_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const legacyVisible = await page.getByRole("heading", { name: LEGACY_HEADING }).isVisible().catch(() => false);
  if (!legacyVisible) {
    return {
      ok: false,
      architecture,
      path: LEGACY_LOGIN_PATH,
      classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_CONTRACT_MISMATCH,
      message: "Legacy buyer login contract unavailable on deployed application",
    };
  }
  await page.getByRole("button", { name: /^Email$/i }).click();
  await page.getByPlaceholder("you@business.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(_password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  try {
    await waitForAuthenticatedNavigation(page, LEGACY_LOGIN_PATH);
    return { ok: true, architecture, path: LEGACY_LOGIN_PATH };
  } catch (error) {
    return {
      ok: false,
      architecture,
      path: LEGACY_LOGIN_PATH,
      classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_FLOW_FAILED,
      message: error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
}

export async function loginForPersona(
  page: Page,
  persona: string,
  email: string,
  password: string,
): Promise<LoginAttemptResult> {
  return authKindForPersona(persona) === "buyer"
    ? loginBuyer(page, email, password)
    : loginStaff(page, email, password);
}

export async function expectUnauthenticatedSession(
  page: Page,
  context: string,
  protectedRoute = "/admin/dispatch-mgmt",
) {
  const pathname = await waitForUnauthenticatedDestination(page, 15_000).catch(
    () => new URL(page.url()).pathname,
  );
  expect(
    isUnauthenticatedDestination(pathname),
    `${context} must land on governed unauthenticated entry, got ${pathname}`,
  ).toBe(true);
  await page.goto(`${getPreviewUrl()}${protectedRoute}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const revisitPath = await waitForUnauthenticatedDestination(page, 15_000).catch(
    () => new URL(page.url()).pathname,
  );
  expect(
    isUnauthenticatedDestination(revisitPath),
    `${context} protected route revisit must not restore session (${revisitPath})`,
  ).toBe(true);
}

export function classifyLoginFailure(
  result: Extract<LoginAttemptResult, { ok: false }>,
  missingSecretNames: string[],
): AuthBlockClassification {
  if (missingSecretNames.length > 0) return AUTH_BLOCK_CLASSIFICATIONS.MISSING_SECRET;
  return result.classification;
}
