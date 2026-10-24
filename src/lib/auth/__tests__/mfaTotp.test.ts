import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MfaError,
  beginEnrolment,
  classifyMfaError,
  formatSetupKey,
  proveSession,
  readJwtAal,
  readMfaState,
  verifyTotpCode,
} from "../mfaTotp";

const jwt = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;

type Overrides = {
  session?: unknown;
  aal?: { currentLevel: string | null; nextLevel: string | null };
  factors?: { all: unknown[]; totp: unknown[] };
  verifyError?: unknown;
  stepUp?: boolean;
  canClose?: boolean;
};

function fakeClient(o: Overrides = {}) {
  const calls: string[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: "session" in o ? o.session : { access_token: jwt({ aal: "aal2" }) } }, error: null })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: o.aal ?? { currentLevel: "aal2", nextLevel: "aal2" }, error: null })),
        listFactors: vi.fn(async () => ({ data: o.factors ?? { all: [], totp: [] }, error: null })),
        unenroll: vi.fn(async ({ factorId }: { factorId: string }) => { calls.push(`unenroll:${factorId}`); return { error: null }; }),
        enroll: vi.fn(async () => { calls.push("enroll"); return { data: { id: "f-new", totp: { qr_code: "<svg/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP" } }, error: null }; }),
        challenge: vi.fn(async () => { calls.push("challenge"); return { data: { id: "c1" }, error: null }; }),
        verify: vi.fn(async () => { calls.push("verify"); return { data: {}, error: (o.verifyError as never) ?? null }; }),
      },
    },
    rpc: vi.fn(async (name: string) => (name === "has_step_up_auth" ? { data: o.stepUp ?? true } : { data: o.canClose ?? true })),
  };
  return { client: client as unknown as SupabaseClient, calls, raw: client };
}

describe("classifyMfaError", () => {
  it("maps Supabase errors to user-safe categories", () => {
    expect(classifyMfaError({ code: "mfa_verification_failed", status: 422 })).toBe("invalid_code");
    expect(classifyMfaError({ message: "Invalid TOTP code entered" })).toBe("invalid_code");
    expect(classifyMfaError({ name: "AuthSessionMissingError" })).toBe("session_expired");
    expect(classifyMfaError({ status: 401 })).toBe("session_expired");
    expect(classifyMfaError({ message: "JWT expired" })).toBe("session_expired");
    expect(classifyMfaError({ status: 429 })).toBe("rate_limited");
    expect(classifyMfaError({ code: "mfa_totp_enroll_not_enabled" })).toBe("mfa_disabled");
    expect(classifyMfaError({ message: "boom" })).toBe("unknown");
    expect(classifyMfaError(null)).toBe("unknown");
  });
});

describe("verifyTotpCode", () => {
  it("rejects malformed codes without any network call", async () => {
    const { client, raw } = fakeClient();
    await expect(verifyTotpCode(client, "f1", "12345")).rejects.toMatchObject({ failure: "malformed_code" });
    await expect(verifyTotpCode(client, "f1", "12ab56")).rejects.toMatchObject({ failure: "malformed_code" });
    expect(raw.auth.mfa.challenge).not.toHaveBeenCalled();
    expect(raw.auth.mfa.verify).not.toHaveBeenCalled();
  });
  it("challenges then verifies a valid 6-digit code (spaces tolerated)", async () => {
    const { client, calls } = fakeClient();
    await verifyTotpCode(client, "f1", "123 456");
    expect(calls).toEqual(["challenge", "verify"]);
  });
  it("surfaces an invalid code as invalid_code", async () => {
    const { client } = fakeClient({ verifyError: { code: "mfa_verification_failed", status: 422 } });
    await expect(verifyTotpCode(client, "f1", "000000")).rejects.toBeInstanceOf(MfaError);
    await expect(verifyTotpCode(client, "f1", "000000")).rejects.toMatchObject({ failure: "invalid_code" });
  });
  it("surfaces an expired session distinctly", async () => {
    const { client } = fakeClient({ verifyError: { name: "AuthApiError", status: 401, code: "session_expired" } });
    await expect(verifyTotpCode(client, "f1", "123456")).rejects.toMatchObject({ failure: "session_expired" });
  });
});

describe("readMfaState", () => {
  it("reports no session without calling MFA endpoints", async () => {
    const { client, raw } = fakeClient({ session: null });
    expect(await readMfaState(client)).toMatchObject({ hasSession: false, verified: [] });
    expect(raw.auth.mfa.listFactors).not.toHaveBeenCalled();
  });
  it("returns only verified TOTP factors and the assurance levels", async () => {
    const { client } = fakeClient({
      aal: { currentLevel: "aal1", nextLevel: "aal2" },
      factors: { all: [], totp: [{ id: "a", status: "verified", friendly_name: "phone" }, { id: "b", status: "unverified" }] },
    });
    expect(await readMfaState(client)).toEqual({ hasSession: true, currentLevel: "aal1", nextLevel: "aal2", verified: [{ id: "a", friendlyName: "phone" }] });
  });
});

describe("beginEnrolment", () => {
  it("removes the user's own abandoned unverified factors, then enrols a fresh TOTP factor", async () => {
    const { client, calls } = fakeClient({ factors: { all: [{ id: "old", factor_type: "totp", status: "unverified" }, { id: "keep", factor_type: "totp", status: "verified" }], totp: [] } });
    const pending = await beginEnrolment(client, new Date("2026-10-24T01:02:03Z"));
    expect(calls).toEqual(["unenroll:old", "enroll"]);
    expect(pending).toMatchObject({ factorId: "f-new", secret: "JBSWY3DPEHPK3PXP" });
  });
});

describe("proveSession", () => {
  it("is ok only when the token, Auth and the database all agree", async () => {
    const { client } = fakeClient();
    expect(await proveSession(client)).toEqual({ jwtAal: "aal2", currentLevel: "aal2", stepUpAccepted: true, canCloseWhatsapp: true, ok: true });
  });
  it("does not trust the token alone: database step-up false means not ok", async () => {
    const { client } = fakeClient({ stepUp: false });
    expect((await proveSession(client)).ok).toBe(false);
  });
  it("enforces wa.intake.close: aal2 without the permission is not ok", async () => {
    const { client } = fakeClient({ canClose: false });
    const proof = await proveSession(client);
    expect(proof).toMatchObject({ stepUpAccepted: true, canCloseWhatsapp: false, ok: false });
  });
  it("an aal1 session is never ok", async () => {
    const { client } = fakeClient({ session: { access_token: jwt({ aal: "aal1" }) }, aal: { currentLevel: "aal1", nextLevel: "aal2" }, stepUp: false, canClose: false });
    expect((await proveSession(client)).ok).toBe(false);
  });
  it("fails closed on an expired session", async () => {
    const { client } = fakeClient({ session: null });
    await expect(proveSession(client)).rejects.toMatchObject({ failure: "session_expired" });
  });
});

describe("helpers", () => {
  it("reads aal from a JWT and tolerates garbage", () => {
    expect(readJwtAal(jwt({ aal: "aal2" }))).toBe("aal2");
    expect(readJwtAal("not-a-jwt")).toBeNull();
    expect(readJwtAal(undefined)).toBeNull();
  });
  it("groups the setup key for manual entry", () => {
    expect(formatSetupKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});
