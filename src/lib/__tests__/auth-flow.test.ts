import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AuthFlowError,
  createAuthStateController,
  getAuthUserMessage,
  getPostLoginRedirectOnError,
  readAuthCache,
  writeAuthCache,
  clearAuthCache,
  AUTH_CACHE_KEY,
  type AuthStatus,
} from "@/lib/auth-flow";
import { getRoleDestination } from "@/lib/auth-routing";

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
});

// Invariant: an authenticated-but-unresolved account (no role assigned, or
// pending approval) must never strand the user on a dead-end failure screen —
// it converges on the same customer-app gate that RoleProtectedRoute and
// getRoleDestination already use for unresolved/unknown roles. A genuine
// authentication failure (bad OTP, network error, blocked account, etc.) must
// remain a failure and must never be silently redirected.
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
