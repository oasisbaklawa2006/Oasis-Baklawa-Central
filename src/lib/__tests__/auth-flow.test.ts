import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AuthFlowError,
  createAuthStateController,
  getAuthUserMessage,
  readAuthCache,
  writeAuthCache,
  clearAuthCache,
  AUTH_CACHE_KEY,
  type AuthStatus,
} from "@/lib/auth-flow";

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
