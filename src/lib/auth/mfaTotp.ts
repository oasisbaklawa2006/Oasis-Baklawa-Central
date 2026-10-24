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
  | "challenge_expired"
  | "factor_missing"
  | "unfinished_setup"
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
  if (code === "mfa_challenge_expired") return "challenge_expired";
  if (code === "mfa_factor_not_found") return "factor_missing";
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
  /** Own TOTP factors that were enrolled but never verified (abandoned or still pending). */
  unverified: MfaFactorSummary[];
  /** The in-progress enrolment still held in this page's memory, if its factor still exists server-side. */
  pending: PendingEnrolment | null;
}

export async function readMfaState(client: SupabaseClient): Promise<MfaState> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) fail(sessionError);
  if (!sessionData?.session) {
    held = null;
    return { hasSession: false, currentLevel: null, nextLevel: null, verified: [], unverified: [], pending: null };
  }

  const [aal, factors] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (aal.error) fail(aal.error);
  if (factors.error) fail(factors.error);

  const unverified = unverifiedTotp(factors.data?.all);
  // Only a factor that still exists unverified can be resumed; anything else is stale memory.
  if (held && !unverified.some((factor) => factor.id === held?.factorId)) held = null;
  return {
    hasSession: true,
    currentLevel: aal.data?.currentLevel ?? null,
    nextLevel: aal.data?.nextLevel ?? null,
    verified: (factors.data?.totp ?? [])
      .filter((factor) => factor.status === "verified")
      .map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null })),
    unverified: unverified.map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null })),
    pending: held,
  };
}

function unverifiedTotp<T extends { factor_type?: string; status?: string }>(all: T[] | null | undefined): T[] {
  return (all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status !== "verified");
}

export interface PendingEnrolment {
  factorId: string;
  /** QR image exactly as returned by Auth (a data URI in current supabase-js). Render via qrImageSrc only. */
  qrSvg: string;
  /** Manual-entry key. Show on demand only; never log. */
  secret: string;
  /** otpauth:// URI, usable as an "open in authenticator" link on a phone. */
  uri: string;
  /** Epoch ms when this key was created, so the owner can tell which authenticator entry is current. */
  createdAt: number;
}

/**
 * Auth returns the TOTP secret exactly once, at enrol time. iOS Safari fires auth events on return from
 * another app, which remounts this page; if the secret lived only in component state, the owner would be
 * forced to enrol again and the authenticator would keep the old, now-dead key. The in-progress enrolment is
 * therefore held in this module's memory (never in browser storage, never logged), keyed by its factor id,
 * and is only ever used while that factor still exists unverified on the server.
 */
let held: PendingEnrolment | null = null;
let inflight: { ownerP: Promise<string | null>; promise: Promise<PendingEnrolment> } | null = null;

export function discardHeldEnrolment(): void {
  held = null;
}

/**
 * Starts an enrolment, or returns the one already in progress. It never replaces an active pending
 * enrolment and never silently deletes another unverified factor: leftovers whose key is no longer
 * available must be discarded explicitly (discardUnfinishedEnrolments) before a new key is made.
 */
export async function beginEnrolment(client: SupabaseClient, now: Date = new Date()): Promise<PendingEnrolment> {
  // The in-flight enrolment is only shared between callers signed in as the same account.
  const ownerP = client.auth.getSession().then((r) => r.data?.session?.user?.id ?? null, () => null);
  if (inflight) {
    const current = inflight;
    const [theirs, mine] = await Promise.all([current.ownerP, ownerP]);
    if (theirs === mine) return current.promise;
  }
  const promise = (async () => {
    const existing = await client.auth.mfa.listFactors();
    if (existing.error) fail(existing.error);
    const leftovers = unverifiedTotp(existing.data?.all);
    if (held && leftovers.some((factor) => factor.id === held?.factorId)) return held;
    held = null;
    if (leftovers.length > 0) throw new MfaError("unfinished_setup");

    const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `oasis-central-${stamp}`,
    });
    if (error || !data) fail(error);
    held = {
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
      createdAt: now.getTime(),
    };
    return held;
  })().finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { ownerP, promise };
  return promise;
}

/** Explicit, user-confirmed removal of this user's own never-verified TOTP factors. */
export async function discardUnfinishedEnrolments(client: SupabaseClient): Promise<void> {
  const existing = await client.auth.mfa.listFactors();
  if (existing.error) fail(existing.error);
  for (const stale of unverifiedTotp(existing.data?.all)) {
    const { error } = await client.auth.mfa.unenroll({ factorId: stale.id });
    if (error) fail(error);
  }
  held = null;
}

/**
 * Auth's enroll() already returns the QR as `data:image/svg+xml;utf-8,<raw svg>`. Percent-encoding that whole
 * string again produced a broken image. Accept either a data URI or bare SVG and emit one well-formed data URI.
 */
export function qrImageSrc(qr: string): string {
  const raw = String(qr ?? "").trim();
  const comma = raw.startsWith("data:") ? raw.indexOf(",") : -1;
  let svg = comma >= 0 ? raw.slice(comma + 1) : raw;
  if (/^%3C/i.test(svg)) {
    try {
      svg = decodeURIComponent(svg);
    } catch {
      /* keep as-is */
    }
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Challenge + verify. Used both to activate a new factor and to step an aal1 session up to aal2. */
export async function verifyTotpCode(client: SupabaseClient, factorId: string, code: string): Promise<void> {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) throw new MfaError("malformed_code");
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) {
    if (classifyMfaError(challenge.error) === "factor_missing" && held?.factorId === factorId) held = null;
    fail(challenge.error);
  }
  const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: cleaned });
  if (verified.error) {
    if (classifyMfaError(verified.error) === "factor_missing" && held?.factorId === factorId) held = null;
    fail(verified.error);
  }
  if (held?.factorId === factorId) held = null;
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
