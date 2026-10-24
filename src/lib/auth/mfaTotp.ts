/**
 * TOTP multi-factor helpers built on the official Supabase Auth MFA API
 * (enroll -> challenge -> verify, getAuthenticatorAssuranceLevel, listFactors).
 *
 * Security notes:
 * - Nothing here logs, stores or forwards the TOTP secret, setup URI or QR code.
 *   They are returned to the caller's in-memory state only.
 * - AAL2 is never asserted by this module. It is only ever *read back* from the
 *   JWT and from the database's own step-up check (`has_step_up_auth`).
 * - Authorisation (`wa.intake.close`) stays enforced by the database; the client
 *   only reports what the database says.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaFailure =
  | "invalid_code"
  | "malformed_code"
  | "session_expired"
  | "rate_limited"
  | "mfa_disabled"
  | "unknown";

export class MfaError extends Error {
  readonly failure: MfaFailure;
  constructor(failure: MfaFailure) {
    super(failure);
    this.name = "MfaError";
    this.failure = failure;
  }
}

type AuthLikeError = { name?: string; message?: string; status?: number; code?: string } | null | undefined;

const SESSION_CODES = new Set(["session_expired", "session_not_found", "bad_jwt", "no_authorization", "refresh_token_not_found"]);

/** Classifies only on structured Auth status/code values; free-text messages are never matched. */
export function classifyMfaError(error: AuthLikeError): MfaFailure {
  if (!error) return "unknown";
  const code = String(error.code ?? "").toLowerCase();
  if (error.name === "AuthSessionMissingError" || error.status === 401 || SESSION_CODES.has(code)) return "session_expired";
  if (error.status === 429 || code === "over_request_rate_limit") return "rate_limited";
  if (code === "mfa_totp_enroll_not_enabled" || code === "mfa_totp_verify_not_enabled") return "mfa_disabled";
  if (code === "mfa_verification_failed") return "invalid_code";
  return "unknown";
}

function fail(error: AuthLikeError): never {
  throw new MfaError(classifyMfaError(error));
}

export interface MfaFactorSummary {
  id: string;
  friendlyName: string | null;
}

export interface MfaState {
  hasSession: boolean;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verified: MfaFactorSummary[];
}

export async function readMfaState(client: SupabaseClient): Promise<MfaState> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) fail(sessionError);
  if (!sessionData?.session) return { hasSession: false, currentLevel: null, nextLevel: null, verified: [] };

  const [aal, factors] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (aal.error) fail(aal.error);
  if (factors.error) fail(factors.error);

  return {
    hasSession: true,
    currentLevel: aal.data?.currentLevel ?? null,
    nextLevel: aal.data?.nextLevel ?? null,
    verified: (factors.data?.totp ?? [])
      .filter((factor) => factor.status === "verified")
      .map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null })),
  };
}

export interface PendingEnrolment {
  factorId: string;
  /** Raw SVG markup returned by Auth. Render only as an <img> data URL. */
  qrSvg: string;
  /** Manual-entry key. Show on demand only; never log. */
  secret: string;
  /** otpauth:// URI, usable as an "open in authenticator" link on a phone. */
  uri: string;
}

export async function beginEnrolment(client: SupabaseClient, now: Date = new Date()): Promise<PendingEnrolment> {
  // Remove this user's own abandoned, never-verified factors so retries start clean
  // (an unverified factor holds a friendly name and counts toward the factor limit).
  const existing = await client.auth.mfa.listFactors();
  if (existing.error) fail(existing.error);
  for (const stale of (existing.data?.all ?? []).filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
    await client.auth.mfa.unenroll({ factorId: stale.id });
  }

  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `oasis-central-${stamp}`,
  });
  if (error || !data) fail(error);
  return { factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

/** Challenge + verify. Used both to activate a new factor and to step an aal1 session up to aal2. */
export async function verifyTotpCode(client: SupabaseClient, factorId: string, code: string): Promise<void> {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) throw new MfaError("malformed_code");
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) fail(challenge.error);
  const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: cleaned });
  if (verified.error) fail(verified.error);
}

export async function removeFactor(client: SupabaseClient, factorId: string): Promise<void> {
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) fail(error);
}

export interface Aal2Proof {
  jwtAal: string | null;
  currentLevel: string | null;
  stepUpAccepted: boolean;
  canCloseWhatsapp: boolean;
  /** true when any read-back errored: the verdicts above are then unknown, not negative. */
  readFailed: boolean;
  /** true only when every independent check agrees and every read succeeded. */
  ok: boolean;
}

export function readJwtAal(accessToken: string | undefined | null): string | null {
  try {
    const part = String(accessToken ?? "").split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const claims = JSON.parse(json) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

/** Three independent read-backs: the JWT claim, Auth's own level, and the database's verdicts. */
export async function proveSession(client: SupabaseClient): Promise<Aal2Proof> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData?.session) fail(sessionError ?? { name: "AuthSessionMissingError" });
  const jwtAal = readJwtAal(sessionData.session?.access_token);
  const [aal, stepUp, close] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.rpc("has_step_up_auth"),
    client.rpc("has_whatsapp_permission", { p_permission_key: "wa.intake.close" }),
  ]);
  const readFailed = Boolean(aal.error || stepUp.error || close.error);
  const currentLevel = aal.data?.currentLevel ?? null;
  const stepUpAccepted = stepUp.data === true;
  const canCloseWhatsapp = close.data === true;
  return {
    jwtAal,
    currentLevel,
    stepUpAccepted,
    canCloseWhatsapp,
    readFailed,
    ok: !readFailed && jwtAal === "aal2" && currentLevel === "aal2" && stepUpAccepted && canCloseWhatsapp,
  };
}

/** Groups a base32 setup key in blocks of four for easier manual entry on a phone. */
export function formatSetupKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}
