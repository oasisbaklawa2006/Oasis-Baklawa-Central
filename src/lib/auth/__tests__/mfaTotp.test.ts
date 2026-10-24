import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MfaError,
  beginEnrolment,
  classifyMfaError,
  discardHeldEnrolment,
  discardUnfinishedEnrolments,
  formatSetupKey,
  qrImageSrc,
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
  enrollId?: string;
  enrollSecret?: string;
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
        enroll: vi.fn(async () => { calls.push("enroll"); return { data: { id: o.enrollId ?? "f-new", totp: { qr_code: "<svg/>", secret: o.enrollSecret ?? "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP" } }, error: null }; }),
        challenge: vi.fn(async () => { calls.push("challenge"); return { data: { id: "c1" }, error: null }; }),
        verify: vi.fn(async () => { calls.push("verify"); return { data: {}, error: (o.verifyError as never) ?? null }; }),
      },
    },
    rpc: vi.fn(async (name: string) => (name === "has_step_up_auth" ? { data: o.stepUp ?? true } : { data: o.canClose ?? true })),
  };
  return { client: client as unknown as SupabaseClient, calls, raw: client };
}

describe("classifyMfaError", () => {
  it("maps structured Supabase status/code values to user-safe categories", () => {
    expect(classifyMfaError({ code: "mfa_verification_failed", status: 422 })).toBe("invalid_code");
    expect(classifyMfaError({ name: "AuthSessionMissingError" })).toBe("session_expired");
    expect(classifyMfaError({ status: 401 })).toBe("session_expired");
    expect(classifyMfaError({ code: "bad_jwt" })).toBe("session_expired");
    expect(classifyMfaError({ status: 429 })).toBe("rate_limited");
    expect(classifyMfaError({ code: "over_request_rate_limit" })).toBe("rate_limited");
    expect(classifyMfaError({ code: "mfa_totp_enroll_not_enabled" })).toBe("mfa_disabled");
    expect(classifyMfaError({ code: "mfa_totp_verify_not_enabled" })).toBe("mfa_disabled");
    expect(classifyMfaError(null)).toBe("unknown");
  });
  it("classifies expired challenges and missing factors by code", () => {
    expect(classifyMfaError({ code: "mfa_challenge_expired", status: 422 })).toBe("challenge_expired");
    expect(classifyMfaError({ code: "mfa_factor_not_found", status: 404 })).toBe("factor_missing");
  });

  it("never classifies from free-text messages", () => {
    expect(classifyMfaError({ message: "Invalid TOTP code entered" })).toBe("unknown");
    expect(classifyMfaError({ message: "JWT expired" })).toBe("unknown");
    expect(classifyMfaError({ message: "rate limit exceeded" })).toBe("unknown");
    expect(classifyMfaError({ message: "MFA is disabled" })).toBe("unknown");
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
    expect(await readMfaState(client)).toEqual({ hasSession: true, currentLevel: "aal1", nextLevel: "aal2", verified: [{ id: "a", friendlyName: "phone" }], unverified: [], pending: null });
  });
});

describe("beginEnrolment", () => {
  const stale = { factors: { all: [{ id: "old", factor_type: "totp", status: "unverified" }, { id: "keep", factor_type: "totp", status: "verified" }], totp: [] } };

  it("enrols a fresh TOTP factor when none is pending", async () => {
    discardHeldEnrolment();
    const { client, calls } = fakeClient();
    const pending = await beginEnrolment(client, new Date("2026-10-24T01:02:03Z"));
    expect(calls).toEqual(["enroll"]);
    expect(pending).toMatchObject({ factorId: "f-new", secret: "JBSWY3DPEHPK3PXP" });
  });

  it("returns the SAME pending factor on a repeat call instead of replacing it", async () => {
    discardHeldEnrolment();
    const first = fakeClient();
    const pending = await beginEnrolment(first.client);
    const second = fakeClient({ factors: { all: [{ id: "f-new", factor_type: "totp", status: "unverified" }], totp: [] } });
    const again = await beginEnrolment(second.client);
    expect(again).toBe(pending);
    expect(second.calls).toEqual([]);
  });

  it("collapses concurrent calls into one enrol", async () => {
    discardHeldEnrolment();
    const { client, raw } = fakeClient();
    await Promise.all([beginEnrolment(client), beginEnrolment(client)]);
    expect(raw.auth.mfa.enroll).toHaveBeenCalledTimes(1);
  });

  it("does not hand one account's in-flight enrolment (secret) to a different account", async () => {
    discardHeldEnrolment();
    const a = fakeClient({ session: { access_token: jwt({ aal: "aal1" }), user: { id: "user-a" } }, enrollId: "f-a", enrollSecret: "AAAAAAAAAAAAAAAA" });
    const b = fakeClient({ session: { access_token: jwt({ aal: "aal1" }), user: { id: "user-b" } }, enrollId: "f-b", enrollSecret: "BBBBBBBBBBBBBBBB" });
    const [pa, pb] = await Promise.all([beginEnrolment(a.client), beginEnrolment(b.client)]);
    expect(pa).toMatchObject({ factorId: "f-a", secret: "AAAAAAAAAAAAAAAA" });
    expect(pb).toMatchObject({ factorId: "f-b", secret: "BBBBBBBBBBBBBBBB" });
    expect(a.raw.auth.mfa.enroll).toHaveBeenCalledTimes(1);
    expect(b.raw.auth.mfa.enroll).toHaveBeenCalledTimes(1);
  });

  it("refuses to silently delete leftover unverified factors whose key is gone", async () => {
    discardHeldEnrolment();
    const { client, calls } = fakeClient(stale);
    await expect(beginEnrolment(client)).rejects.toMatchObject({ failure: "unfinished_setup" });
    expect(calls).toEqual([]);
  });

  it("removes only unverified TOTP factors, and only when explicitly asked", async () => {
    discardHeldEnrolment();
    const { client, calls } = fakeClient(stale);
    await discardUnfinishedEnrolments(client);
    expect(calls).toEqual(["unenroll:old"]);
  });

  it("forgets a held enrolment whose factor no longer exists server-side", async () => {
    discardHeldEnrolment();
    await beginEnrolment(fakeClient().client);
    const state = await readMfaState(fakeClient({ aal: { currentLevel: "aal1", nextLevel: "aal1" }, factors: { all: [], totp: [] } }).client);
    expect(state.pending).toBeNull();
  });
});

describe("qrImageSrc", () => {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0h4v4H0z' fill='#000'/></svg>";
  const decode = (src: string) => decodeURIComponent(src.slice(src.indexOf(",") + 1));

  it("builds one well-formed data URI from Auth's data URI (raw SVG payload)", () => {
    const src = qrImageSrc(`data:image/svg+xml;utf-8,${svg}`);
    expect(src.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    expect(src).not.toMatch(/data%3A/i);
    expect(decode(src)).toBe(svg);
  });

  it("also accepts a bare SVG and an already percent-encoded payload", () => {
    expect(decode(qrImageSrc(svg))).toBe(svg);
    expect(decode(qrImageSrc(`data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`))).toBe(svg);
  });
});

describe("proveSession", () => {
  it("is ok only when the token, Auth and the database all agree", async () => {
    const { client } = fakeClient();
    expect(await proveSession(client)).toEqual({ jwtAal: "aal2", currentLevel: "aal2", stepUpAccepted: true, canCloseWhatsapp: true, readFailed: false, ok: true });
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
  it("reports a failed read-back as unknown (readFailed), never as ok and never as a negative verdict", async () => {
    const { client, raw } = fakeClient();
    raw.rpc.mockImplementation(async (name: string) => (name === "has_step_up_auth" ? { data: null, error: { message: "network" } } : { data: true }));
    const proof = await proveSession(client);
    expect(proof.readFailed).toBe(true);
    expect(proof.ok).toBe(false);
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
