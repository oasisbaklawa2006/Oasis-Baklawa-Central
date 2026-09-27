import { expect, type Page } from "@playwright/test";
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
const AUTH_SURFACE_SETTLE_TIMEOUT_MS = 30_000;
const ROUTE_GUARD_SETTLE_TIMEOUT_MS = 30_000;

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

async function waitForVisibleHeading(page: Page, name: RegExp, timeout = AUTH_SURFACE_SETTLE_TIMEOUT_MS) {
  try {
    await expect(page.getByRole("heading", { name })).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

export async function waitForUnauthenticatedDestination(
  page: Page,
  context: string,
  timeout = ROUTE_GUARD_SETTLE_TIMEOUT_MS,
) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `${context} must settle on a governed unauthenticated destination`,
      timeout,
      intervals: [100, 250, 500],
    })
    .toSatisfy((pathname: string) => isUnauthenticatedDestination(pathname));
  return new URL(page.url()).pathname;
}

export async function detectAuthArchitecture(page: Page): Promise<AuthArchitecture> {
  await page.goto(`${getPreviewUrl()}${LEGACY_LOGIN_PATH}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await expect
    .poll(async () => {
      if (await page.getByRole("heading", { name: LEGACY_HEADING }).isVisible().catch(() => false)) return "legacy";
      if (await page.getByRole("heading", { name: AUTH_ENTRY_HEADING }).isVisible().catch(() => false)) return "split";
      return "pending";
    }, {
      message: "Authentication entry must render before architecture detection",
      timeout: AUTH_SURFACE_SETTLE_TIMEOUT_MS,
      intervals: [100, 250, 500],
    })
    .not.toBe("pending");

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
  return (await waitForVisibleHeading(page, STAFF_HEADING)) ? "split" : "legacy";
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
    const onStaffLogin = await waitForVisibleHeading(page, STAFF_HEADING);
    if (!onStaffLogin) {
      return {
        ok: false,
        architecture,
        path: STAFF_LOGIN_PATH,
        classification: AUTH_BLOCK_CLASSIFICATIONS.AUTH_CONTRACT_MISMATCH,
        message: "Staff login surface missing Employee Access heading at /staff/login",
      };
    }
    await page.getByPlaceholder("you@oasisbaklawa.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
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
  const legacyVisible = await waitForVisibleHeading(page, LEGACY_HEADING);
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
    const onBuyerLogin = await waitForVisibleHeading(page, BUYER_HEADING);
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
  const legacyVisible = await waitForVisibleHeading(page, LEGACY_HEADING);
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
  await waitForUnauthenticatedDestination(page, context);
  await page.goto(`${getPreviewUrl()}${protectedRoute}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await waitForUnauthenticatedDestination(page, `${context} protected route revisit`);
}

export function classifyLoginFailure(
  result: Extract<LoginAttemptResult, { ok: false }>,
  missingSecretNames: string[],
): AuthBlockClassification {
  if (missingSecretNames.length > 0) return AUTH_BLOCK_CLASSIFICATIONS.MISSING_SECRET;
  return result.classification;
}
