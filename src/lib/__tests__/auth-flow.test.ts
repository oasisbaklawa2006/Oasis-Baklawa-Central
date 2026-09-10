import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AuthFlowError,
  createAuthStateController,
  getCustomerAuthUserMessage,
  getAuthUserMessage,
  getMissingProfileResolution,
  getPostLoginRedirectOnError,
  readAuthCache,
  writeAuthCache,
  clearAuthCache,
  AUTH_CACHE_KEY,
  type AuthStatus,
} from "@/lib/auth-flow";
import { getRoleDestination } from "@/lib/auth-routing";

// Codacy-safe fixed module-relative root (no dynamic path taint).
const ROOT = join(import.meta.dirname, "..");

describe("auth-flow / state controller", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("starts at the supplied initial status", () => {
    const c = createAuthStateController("verifying_otp");
    expect(c.getStatus()).toBe("verifying_otp");
  });

  it("transitions status and reflects it via getStatus", () => {
    const c = createAuthStateController();
    c.setStatus("verifying_otp" as AuthStatus, {
      attemptId: "x",
      method: "mobile_otp",
      identifier: "+919891162212",
      result: "started",
    });
    expect(c.getStatus()).toBe("verifying_otp");
  });

  it("clearAllTimers cancels every registered timer (no late timeout firings)", () => {
    vi.useFakeTimers();
    const c = createAuthStateController();
    const fired: string[] = [];
    c.registerTimer(setTimeout(() => fired.push("a"), 100));
    c.registerTimer(setTimeout(() => fired.push("b"), 200));
    c.clearAllTimers();
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);
  });

  it("clearTimer removes a specific timer only", () => {
    vi.useFakeTimers();
    const c = createAuthStateController();
    const fired: string[] = [];
    const t1 = c.registerTimer(setTimeout(() => fired.push("a"), 100));
    c.registerTimer(setTimeout(() => fired.push("b"), 100));
    c.clearTimer(t1);
    vi.advanceTimersByTime(500);
    expect(fired).toEqual(["b"]);
  });

  it("finalize aborts every controller and clears every timer", () => {
    vi.useFakeTimers();
    const c = createAuthStateController();
    const ac = c.createAbortController();
    const fired: string[] = [];
    c.registerTimer(setTimeout(() => fired.push("a"), 100));
    c.finalize();
    expect(ac.signal.aborted).toBe(true);
    vi.advanceTimersByTime(500);
    expect(fired).toEqual([]);
  });
});

describe("auth-flow / cache", () => {
  beforeEach(() => localStorage.clear());

  it("write -> read round trip", () => {
    writeAuthCache({ userId: "u1", companyId: "c1", role: "ADMIN", priceTier: "B2B" });
    expect(readAuthCache()).toEqual({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      priceTier: "B2B",
    });
  });

  it("clearAuthCache removes the key", () => {
    writeAuthCache({ userId: "u1", companyId: null, role: null, priceTier: null });
    clearAuthCache();
    expect(localStorage.getItem(AUTH_CACHE_KEY)).toBeNull();
    expect(readAuthCache()).toBeNull();
  });

  it("readAuthCache returns null on corrupt JSON", () => {
    localStorage.setItem(AUTH_CACHE_KEY, "{not json");
    expect(readAuthCache()).toBeNull();
  });
});

describe("auth-flow / errors", () => {
  it("AuthFlowError carries a code and final state", () => {
    const e = new AuthFlowError("ACCOUNT_BLOCKED", "blocked", "failed");
    expect(e.code).toBe("ACCOUNT_BLOCKED");
    expect(e.finalState).toBe("failed");
    expect(getAuthUserMessage(e)).toBe("Account blocked. Please contact support.");
  });

  it("getAuthUserMessage maps unknown errors safely", () => {
    expect(getAuthUserMessage(new Error("boom"))).toBe("boom");
    expect(getAuthUserMessage("nonsense")).toBe("Authentication failed. Please try again.");
  });

  it("keeps provider details out of customer-facing authentication errors", () => {
    expect(getCustomerAuthUserMessage(new Error("PostgREST 500 SQLSTATE 23505"))).toBe("Authentication failed. Please try again.");
    expect(getCustomerAuthUserMessage(new Error("Invalid login credentials"))).toBe("Invalid email or password.");
    expect(getCustomerAuthUserMessage(new AuthFlowError("ACCOUNT_BLOCKED", "internal detail"))).toBe("Account blocked. Please contact support.");
  });
});

// Invariant: an authenticated-but-unresolved account (no role assigned, or
// pending approval) must never strand the user on a dead-end failure screen —
// it converges on the same customer-app gate that RoleProtectedRoute and
// getRoleDestination already use for unresolved/unknown roles. A genuine
// authentication failure (bad OTP, network error, blocked account, etc.) must
// remain a failure and must never be silently redirected.
// Issue #561 — physical UAT, fresh B2B buyer.
// msg91-otp creates a verified auth user and inserts public.users.role='PENDING'
// with no profiles row and no company. That is legitimate onboarding, not a
// corrupt account, and must classify as ACCOUNT_PENDING so the verified session
// survives and lands on /customer-app-redirect. Every other role with a missing
// profile AND missing company stays fail-closed on PROFILE_MISSING.
describe("auth-flow / getMissingProfileResolution", () => {
  it("classifies a PENDING role as pending onboarding", () => {
    expect(getMissingProfileResolution("PENDING")).toBe("ACCOUNT_PENDING");
  });

  it("normalizes casing and surrounding whitespace before classifying", () => {
    expect(getMissingProfileResolution("pending")).toBe("ACCOUNT_PENDING");
    expect(getMissingProfileResolution("Pending")).toBe("ACCOUNT_PENDING");
    expect(getMissingProfileResolution("  pending  ")).toBe("ACCOUNT_PENDING");
  });

  it("stays fail-closed for buyer roles that are not PENDING", () => {
    expect(getMissingProfileResolution("CUSTOMER_USER")).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("CUSTOMER_ADMIN")).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("APPROVED")).toBe("PROFILE_MISSING");
  });

  it("stays fail-closed for internal staff roles", () => {
    expect(getMissingProfileResolution("SUPER_ADMIN")).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("ADMIN")).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("SALES_EXECUTIVE")).toBe("PROFILE_MISSING");
  });

  it("stays fail-closed for absent or empty roles", () => {
    expect(getMissingProfileResolution(null)).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution(undefined)).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("")).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("   ")).toBe("PROFILE_MISSING");
  });

  // PR #562 security regression: a deliberately deactivated PENDING account must
  // never reach the ACCOUNT_PENDING path (which keeps the verified session and
  // enters /customer-app-redirect). It has to stay blocked, fail-closed.
  it("blocks a PENDING account that is explicitly inactive", () => {
    expect(getMissingProfileResolution("PENDING", false)).toBe("ACCOUNT_BLOCKED");
    expect(getMissingProfileResolution("pending", false)).toBe("ACCOUNT_BLOCKED");
    expect(getMissingProfileResolution("  Pending  ", false)).toBe("ACCOUNT_BLOCKED");
  });

  it("keeps fresh onboarding when is_active is true, null or absent", () => {
    expect(getMissingProfileResolution("PENDING", true)).toBe("ACCOUNT_PENDING");
    expect(getMissingProfileResolution("PENDING", null)).toBe("ACCOUNT_PENDING");
    expect(getMissingProfileResolution("PENDING", undefined)).toBe("ACCOUNT_PENDING");
    expect(getMissingProfileResolution("PENDING")).toBe("ACCOUNT_PENDING");
  });

  it("does not change non-PENDING classification for any is_active value", () => {
    expect(getMissingProfileResolution("CUSTOMER_USER", false)).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("SUPER_ADMIN", false)).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution(null, false)).toBe("PROFILE_MISSING");
    expect(getMissingProfileResolution("APPROVED", true)).toBe("PROFILE_MISSING");
  });
});

// Issue #561 — the missing-profile branch of resolveUserByIdentifier must route
// through the helper above, not throw PROFILE_MISSING unconditionally.
describe("auth-flow / missing-profile branch wiring", () => {
  const source = readFileSync(join(ROOT, "auth-flow.ts"), "utf8");

  it("consults getMissingProfileResolution inside the missing profile+company branch", () => {
    const branch = source.slice(source.indexOf("if (!profileRow && !matchedUser.company_id)"));
    expect(branch).toContain("getMissingProfileResolution(matchedUser.role, matchedUser.is_active)");
  });

  it("throws ACCOUNT_BLOCKED before the pending path when the helper says blocked", () => {
    const branch = source.slice(source.indexOf("if (!profileRow && !matchedUser.company_id)"));
    const blockedAt = branch.indexOf('throw new AuthFlowError("ACCOUNT_BLOCKED"');
    const pendingAt = branch.indexOf('throw new AuthFlowError("ACCOUNT_PENDING"');
    expect(blockedAt).toBeGreaterThan(-1);
    expect(pendingAt).toBeGreaterThan(-1);
    expect(blockedAt).toBeLessThan(pendingAt);
    expect(branch).toContain('missingProfileResolution === "ACCOUNT_BLOCKED"');
  });

  it("still throws PROFILE_MISSING for the fail-closed path", () => {
    expect(source).toContain('throw new AuthFlowError("PROFILE_MISSING", USER_MESSAGE_BY_CODE.PROFILE_MISSING)');
  });
});

describe("auth-flow / post-login redirect for unresolved accounts", () => {
  it("routes ROLE_NOT_ASSIGNED to the customer-app gate", () => {
    const error = new AuthFlowError("ROLE_NOT_ASSIGNED", "Role not assigned. Please contact an administrator.");
    expect(getPostLoginRedirectOnError(error)).toBe("/customer-app-redirect");
  });

  it("routes ACCOUNT_PENDING to the customer-app gate", () => {
    const error = new AuthFlowError("ACCOUNT_PENDING", "Account pending approval.");
    expect(getPostLoginRedirectOnError(error)).toBe("/customer-app-redirect");
  });

  it("matches the destination used for unresolved/unknown staff roles", () => {
    expect(getPostLoginRedirectOnError(new AuthFlowError("ROLE_NOT_ASSIGNED", "x"))).toBe(getRoleDestination(null));
    expect(getPostLoginRedirectOnError(new AuthFlowError("ACCOUNT_PENDING", "x"))).toBe(getRoleDestination("PENDING"));
  });

  it("never redirects a genuine authentication failure — it stays a failure", () => {
    expect(getPostLoginRedirectOnError(new AuthFlowError("ACCOUNT_BLOCKED", "blocked"))).toBeNull();
    expect(getPostLoginRedirectOnError(new AuthFlowError("NETWORK_ERROR", "network"))).toBeNull();
    expect(getPostLoginRedirectOnError(new AuthFlowError("SESSION_CREATE_FAILED", "session"))).toBeNull();
    expect(getPostLoginRedirectOnError(new AuthFlowError("DUPLICATE_IDENTITY", "dup"))).toBeNull();
    expect(getPostLoginRedirectOnError(new Error("plain error"))).toBeNull();
    expect(getPostLoginRedirectOnError("not an error")).toBeNull();
  });

  it("never resolves to a deleted Central customer route", () => {
    const deletedRoutes = ["/welcome", "/approval-pending", "/home", "/catalogue", "/cart", "/orders", "/account"];
    const destination = getPostLoginRedirectOnError(new AuthFlowError("ACCOUNT_PENDING", "x"));
    expect(deletedRoutes).not.toContain(destination);
    expect(destination).toBe("/customer-app-redirect");
  });
});