import { supabase } from "@/integrations/supabase/client";
import { fetchAuthRoleRecord, getRoleDestination, isInternalStaffUser, isStaffRole, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";
import { normalizeIdentifier, normalizePhone } from "@/lib/auth-identity";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";

export const AUTH_CACHE_KEY = "oasis_auth_cache";

export type AuthStatus =
  | "idle"
  | "entering_identifier"
  | "sending_otp"
  | "otp_sent"
  | "verifying_otp"
  | "verification_success"
  | "account_resolution_in_progress"
  | "profile_loading"
  | "role_loading"
  | "session_creation_in_progress"
  | "authenticated"
  | "failed"
  | "fallback_to_email";

export interface AuthCache {
  userId: string;
  companyId: string | null;
  role: string | null;
  priceTier: string | null;
}

export interface ResolvedUserRecord {
  userId: string;
  role: string | null;
  companyId: string | null;
  profileStatus: string | null;
  isInternalStaff: boolean;
  isActive: boolean | null;
}

export interface CompletedAuthResult {
  attemptId: string;
  identifier: string;
  role: string | null;
  companyId: string | null;
  destination: string;
  userId: string;
}

export class AuthFlowError extends Error {
  code: string;
  finalState: AuthStatus;

  constructor(code: string, message: string, finalState: AuthStatus = "failed") {
    super(message);
    this.code = code;
    this.finalState = finalState;
  }
}

const USER_MESSAGE_BY_CODE: Record<string, string> = {
  OTP_INVALID: "OTP invalid. Please enter the correct code and try again.",
  OTP_EXPIRED: "OTP expired. Please request a new code.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  VERIFICATION_TIMED_OUT: "Verification timed out. Please try again or use Email login.",
  USER_NOT_REGISTERED: "User not registered.",
  PHONE_NOT_LINKED: "Phone not linked to an approved portal account.",
  EMAIL_NOT_LINKED: "Email not linked to an approved portal account.",
  ACCOUNT_PENDING: "Account pending approval.",
  ACCOUNT_BLOCKED: "Account blocked. Please contact support.",
  ROLE_NOT_ASSIGNED: "Role not assigned. Please contact an administrator.",
  PROFILE_MISSING: "Profile missing. Please contact support.",
  DUPLICATE_IDENTITY: "Duplicate identity records found. Please contact support.",
  SESSION_CREATE_FAILED: "Session could not be created.",
  DASHBOARD_LOAD_FAILED: "Dashboard could not be loaded.",
  AUTH_UNAUTHORIZED: "You are not authorized to access this app.",
  PROVIDER_NOT_LINKED: "Provider login not linked to an approved portal account.",
  STAFF_MEMBERSHIP_REQUIRED: "This sign-in is for Oasis staff only. Buyers should use B2B Client Login.",
  BUYER_MEMBERSHIP_REQUIRED: "This sign-in is for B2B buyers only. Staff should use Oasis Staff Login.",
};

type PublicUserRow = {
  id: string;
  role: string | null;
  company_id: string | null;
  is_active: boolean | null;
  phone: string | null;
  mobile_number: string | null;
  email: string | null;
  secondary_phones?: string[] | null;
};

export function getAuthUserMessage(error: unknown) {
  if (error instanceof AuthFlowError) {
    return USER_MESSAGE_BY_CODE[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

/**
 * Returns the bounded copy that may be shown in a customer-facing auth view.
 * Detailed provider/RPC errors remain available to the auth audit log only.
 */
export function getCustomerAuthUserMessage(error: unknown): string {
  if (error instanceof AuthFlowError) {
    return USER_MESSAGE_BY_CODE[error.code] ?? "Authentication failed. Please try again.";
  }

  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  if (raw.includes("invalid") && (raw.includes("credential") || raw.includes("password") || raw.includes("login"))) {
    return "Invalid email or password.";
  }
  if (raw.includes("network") || raw.includes("timeout") || raw.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  return "Authentication failed. Please try again.";
}

// Unresolved-account error codes: the account exists but isn't staff-authorized
// yet (no role, or pending approval). These are not authentication failures —
// the correct outcome is the same customer-app gate an unresolved role hits
// post-login (see getRoleDestination), not a stuck failure state on /login.
const UNRESOLVED_ACCOUNT_REDIRECT_CODES = new Set(["ROLE_NOT_ASSIGNED", "ACCOUNT_PENDING"]);

/**
 * Surface-aware: an unresolved account (no role, or pending approval) only
 * converges on /buyer/access-request for the buyer surface (and the neutral
 * entry point, which has no membership requirement of its own). The staff
 * surface must never send an unresolved/pending identity into B2B buyer
 * onboarding — on `requiredMembership === "staff"` this always returns null,
 * which leaves the caller's AuthFlowError to propagate and fail closed.
 */
export function getPostLoginRedirectOnError(error: unknown, requiredMembership?: RequiredMembership): string | null {
  if (requiredMembership === "staff") return null;
  if (error instanceof AuthFlowError && UNRESOLVED_ACCOUNT_REDIRECT_CODES.has(error.code)) {
    return "/buyer/access-request";
  }
  return null;
}

/**
 * Issue #561 — new-buyer onboarding.
 *
 * A freshly OTP-verified buyer legitimately has no `profiles` row and no company yet:
 * `msg91-otp` creates the verified auth user and inserts `public.users.role = 'PENDING'`.
 * That state is onboarding, not corruption, and must keep the verified session so the
 * unresolved-account redirect can send it to /buyer/access-request.
 *
 * Every other role with a missing profile AND missing company stays fail-closed.
 */
export function getMissingProfileResolution(
  role: string | null | undefined,
  isActive?: boolean | null,
): "ACCOUNT_BLOCKED" | "ACCOUNT_PENDING" | "PROFILE_MISSING" {
  if (normalizeRole(role) !== "PENDING") return "PROFILE_MISSING";
  // A deliberately deactivated pending account must never keep a session.
  // `is_active` may be null/undefined on freshly MSG91-created rows: that is onboarding, not a block.
  return isActive === false ? "ACCOUNT_BLOCKED" : "ACCOUNT_PENDING";
}

export function readAuthCache(): AuthCache | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeAuthCache(data: AuthCache) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) — cache write is best-effort
  }
}

export function clearAuthCache() {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // localStorage unavailable — nothing to clear
  }
}

export function createAuthStateController(initialStatus: AuthStatus = "idle") {
  let status = initialStatus;
  const timers = new Set<number | ReturnType<typeof setTimeout>>();
  const abortControllers = new Set<AbortController>();

  return {
    getStatus: () => status,
    setStatus: (next: AuthStatus, meta?: { attemptId: string; method: AuthAttemptMethod; identifier?: string | null; result?: "started" | "success" | "failed" | "info"; error?: string | null; details?: Record<string, unknown> }) => {
      status = next;
      if (meta) {
        logAuthEvent("AUTH_STATE_UPDATED", {
          ...meta,
          result: meta.result ?? (next === "failed" ? "failed" : next === "authenticated" ? "success" : "info"),
          details: { nextStatus: next, ...(meta.details ?? {}) },
        });
      }
    },
    registerTimer: (timer: number | ReturnType<typeof setTimeout>) => {
      timers.add(timer);
      return timer;
    },
    clearTimer: (timer: number | ReturnType<typeof setTimeout> | null | undefined) => {
      if (!timer) return;
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      timers.delete(timer);
    },
    clearAllTimers: () => {
      timers.forEach((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
      timers.clear();
    },
    createAbortController: () => {
      const controller = new AbortController();
      abortControllers.add(controller);
      return controller;
    },
    finalize: () => {
      timers.forEach((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
      timers.clear();
      abortControllers.forEach((controller) => controller.abort());
      abortControllers.clear();
    },
  };
}

async function fetchPriceTier(companyId: string | null) {
  if (!companyId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("price_tier")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data?.price_tier ?? null;
}

function resolveProfileStatus(profileRow: { status?: string | null; is_approved?: boolean | null } | null | undefined) {
  const normalizedStatus = profileRow?.status?.trim().toLowerCase() ?? null;
  if (normalizedStatus) return normalizedStatus;
  if (profileRow?.is_approved === true) return "approved";
  return null;
}

function dedupeRecords<T extends { id: string }>(rows: T[] | null | undefined) {
  if (!rows?.length) return [] as T[];
  const map = new Map<string, T>();
  rows.forEach((row) => map.set(row.id, row));
  return Array.from(map.values());
}

function rowMatchesIdentifier(row: PublicUserRow, identifier: ReturnType<typeof normalizeIdentifier>) {
  if (identifier.kind === "email") {
    return (row.email ?? "").trim().toLowerCase() === identifier.normalized;
  }

  const phoneVariants = [row.phone, row.mobile_number, ...(row.secondary_phones ?? [])]
    .filter(Boolean)
    .map((value) => normalizePhone(String(value)).last10)
    .filter(Boolean);

  return phoneVariants.includes(identifier.last10 ?? "");
}

async function fetchUsersByIdentifier(identifier: ReturnType<typeof normalizeIdentifier>, attemptId: string, method: AuthAttemptMethod) {
  const baseSelect = "id, role, company_id, is_active, phone, mobile_number, email, secondary_phones";

  if (identifier.kind === "email") {
    const { data, error } = await supabase
      .from("users")
      .select(baseSelect)
      .ilike("email", identifier.normalized)
      .limit(5);

    if (error) {
      logAuthEvent("USER_RESOLUTION_FAILED", {
        attemptId,
        method,
        identifier: identifier.normalized,
        result: "failed",
        error: error.message,
      });
      throw new AuthFlowError("NETWORK_ERROR", error.message);
    }

    return dedupeRecords((data ?? []) as PublicUserRow[]).filter((row) => rowMatchesIdentifier(row, identifier));
  }

  const pattern = `%${identifier.last10}%`;
  const { data, error } = await supabase
    .from("users")
    .select(baseSelect)
    .or(`phone.ilike.${pattern},mobile_number.ilike.${pattern},secondary_phones.cs.{${identifier.last10}}`)
    .limit(10);

  if (error) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: identifier.normalized,
      result: "failed",
      error: error.message,
    });
    throw new AuthFlowError("NETWORK_ERROR", error.message);
  }

  return dedupeRecords((data ?? []) as PublicUserRow[]).filter((row) => rowMatchesIdentifier(row, identifier));
}

async function resolveLinkedAccount(identifier: ReturnType<typeof normalizeIdentifier>, attemptId: string, method: AuthAttemptMethod, userId?: string) {
  logAuthEvent("ACCOUNT_LINK_RESOLUTION_STARTED", {
    attemptId,
    method,
    identifier: identifier.normalized,
    result: "started",
    details: { userId: userId ?? null },
  });

  let directUser: PublicUserRow | null = null;
  if (userId) {
    const { data, error } = await supabase
      .from("users")
      .select("id, role, company_id, is_active, phone, mobile_number, email, secondary_phones")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      logAuthEvent("ACCOUNT_LINK_RESOLUTION_FAILED", {
        attemptId,
        method,
        identifier: identifier.normalized,
        result: "failed",
        error: error.message,
        details: { userId },
      });
      throw new AuthFlowError("NETWORK_ERROR", error.message);
    }

    directUser = (data as PublicUserRow | null) ?? null;
  }

  const matches = await fetchUsersByIdentifier(identifier, attemptId, method);

  if (directUser) {
    if (!rowMatchesIdentifier(directUser, identifier)) {
      logAuthEvent("ACCOUNT_LINK_RESOLUTION_FAILED", {
        attemptId,
        method,
        identifier: identifier.normalized,
        result: "failed",
        error: "identifier_not_linked_to_authenticated_user",
        details: { userId },
      });
      throw new AuthFlowError(
        identifier.kind === "phone" ? "PHONE_NOT_LINKED" : "EMAIL_NOT_LINKED",
        identifier.kind === "phone" ? USER_MESSAGE_BY_CODE.PHONE_NOT_LINKED : USER_MESSAGE_BY_CODE.EMAIL_NOT_LINKED,
      );
    }

    logAuthEvent("ACCOUNT_LINK_RESOLUTION_SUCCESS", {
      attemptId,
      method,
      identifier: identifier.normalized,
      result: "success",
      details: { userId: directUser.id, matchedBy: "authenticated_user" },
    });

    return { directUser, matches };
  }

  if (!matches.length) {
    logAuthEvent("ACCOUNT_LINK_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: identifier.normalized,
      result: "failed",
      error: "not_linked",
    });
    throw new AuthFlowError(
      identifier.kind === "phone" ? "PHONE_NOT_LINKED" : "EMAIL_NOT_LINKED",
      identifier.kind === "phone" ? USER_MESSAGE_BY_CODE.PHONE_NOT_LINKED : USER_MESSAGE_BY_CODE.EMAIL_NOT_LINKED,
    );
  }

  if (matches.length > 1) {
    logAuthEvent("ACCOUNT_LINK_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: identifier.normalized,
      result: "failed",
      error: `duplicate_records:${matches.length}`,
    });
    throw new AuthFlowError("DUPLICATE_IDENTITY", USER_MESSAGE_BY_CODE.DUPLICATE_IDENTITY);
  }

  logAuthEvent("ACCOUNT_LINK_RESOLUTION_SUCCESS", {
    attemptId,
    method,
    identifier: identifier.normalized,
    result: "success",
    details: { userId: matches[0].id, matchedBy: identifier.kind },
  });

  return { directUser: matches[0], matches };
}

async function resolveUserByIdentifier(identifierInput: string, attemptId: string, method: AuthAttemptMethod, userId?: string): Promise<ResolvedUserRecord> {
  const normalized = normalizeIdentifier(identifierInput);
  logAuthEvent("USER_RESOLUTION_STARTED", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "started",
    details: { userId: userId ?? null },
  });

  const { directUser, matches } = await resolveLinkedAccount(normalized, attemptId, method, userId);
  const matchedUser = directUser ?? matches[0];

  if (!matchedUser) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "not_registered",
    });
    throw new AuthFlowError("USER_NOT_REGISTERED", USER_MESSAGE_BY_CODE.USER_NOT_REGISTERED);
  }

  logAuthEvent("PROFILE_FETCH_STARTED", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "started",
    details: { userId: matchedUser.id },
  });

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("status, is_approved, company_id")
    .eq("id", matchedUser.id)
    .maybeSingle();

  if (profileError) {
    logAuthEvent("PROFILE_FETCH_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: profileError.message,
      details: { userId: matchedUser.id },
    });
    throw new AuthFlowError("NETWORK_ERROR", profileError.message);
  }

  if (!profileRow && !matchedUser.company_id) {
    const missingProfileResolution = getMissingProfileResolution(matchedUser.role, matchedUser.is_active);

    if (missingProfileResolution === "ACCOUNT_BLOCKED") {
      logAuthEvent("PROFILE_FETCH_FAILED", {
        attemptId,
        method,
        identifier: normalized.normalized,
        result: "failed",
        error: "pending_onboarding_blocked",
        details: { userId: matchedUser.id, role: normalizeRole(matchedUser.role) },
      });
      throw new AuthFlowError("ACCOUNT_BLOCKED", USER_MESSAGE_BY_CODE.ACCOUNT_BLOCKED, "failed");
    }

    if (missingProfileResolution === "ACCOUNT_PENDING") {
      logAuthEvent("PROFILE_FETCH_FAILED", {
        attemptId,
        method,
        identifier: normalized.normalized,
        result: "failed",
        error: "pending_onboarding_profile_absent",
        details: { userId: matchedUser.id, role: normalizeRole(matchedUser.role) },
      });
      throw new AuthFlowError("ACCOUNT_PENDING", USER_MESSAGE_BY_CODE.ACCOUNT_PENDING, "failed");
    }

    logAuthEvent("PROFILE_FETCH_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "profile_missing",
      details: { userId: matchedUser.id },
    });
    throw new AuthFlowError("PROFILE_MISSING", USER_MESSAGE_BY_CODE.PROFILE_MISSING);
  }

  logAuthEvent("PROFILE_FETCH_SUCCESS", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "success",
    details: { userId: matchedUser.id },
  });

  logAuthEvent("ROLE_FETCH_STARTED", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "started",
    details: { userId: matchedUser.id },
  });

  const [authRecord, isInternalStaff] = await Promise.all([
    fetchAuthRoleRecord(matchedUser.id),
    isInternalStaffUser(matchedUser.id),
  ]);

  const resolvedRole = normalizeRole(authRecord.role ?? matchedUser.role);
  const resolvedCompanyId = authRecord.company_id ?? profileRow?.company_id ?? matchedUser.company_id ?? null;
  const resolvedProfileStatus = resolveProfileStatus(profileRow);
  const active = matchedUser.is_active;

  if (!resolvedRole) {
    logAuthEvent("ROLE_FETCH_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "role_missing",
      details: { userId: matchedUser.id },
    });
    throw new AuthFlowError("ROLE_NOT_ASSIGNED", USER_MESSAGE_BY_CODE.ROLE_NOT_ASSIGNED);
  }

  logAuthEvent("ROLE_FETCH_SUCCESS", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "success",
    details: { userId: matchedUser.id, role: resolvedRole },
  });

  if (active === false) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "account_blocked",
      details: { userId: matchedUser.id },
    });
    throw new AuthFlowError("ACCOUNT_BLOCKED", USER_MESSAGE_BY_CODE.ACCOUNT_BLOCKED);
  }

  if (!isInternalStaff && (resolvedProfileStatus === "pending" || resolvedRole === "PENDING" || (isStorefrontRole(resolvedRole) && !resolvedCompanyId))) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "account_pending",
      details: { userId: matchedUser.id, role: resolvedRole, companyId: resolvedCompanyId },
    });
    throw new AuthFlowError("ACCOUNT_PENDING", USER_MESSAGE_BY_CODE.ACCOUNT_PENDING, "failed");
  }

  logAuthEvent("USER_RESOLUTION_SUCCESS", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "success",
    details: { userId: matchedUser.id, role: resolvedRole, companyId: resolvedCompanyId, isInternalStaff },
  });

  return {
    userId: matchedUser.id,
    role: resolvedRole,
    companyId: resolvedCompanyId,
    profileStatus: resolvedProfileStatus,
    isInternalStaff,
    isActive: active,
  };
}

export async function completeAuthLogin(params: {
  identity: string;
  method: AuthAttemptMethod;
  userId?: string;
  attemptId?: string;
  setStatus?: (next: AuthStatus, meta?: { result?: "started" | "success" | "failed" | "info"; error?: string | null; details?: Record<string, unknown> }) => void;
}): Promise<CompletedAuthResult> {
  const attemptId = params.attemptId ?? createAuthAttemptId();
  const normalized = normalizeIdentifier(params.identity);

  const setStatus = (next: AuthStatus, meta?: { result?: "started" | "success" | "failed" | "info"; error?: string | null; details?: Record<string, unknown> }) => {
    params.setStatus?.(next, meta);
    logAuthEvent("AUTH_STATE_UPDATED", {
      attemptId,
      method: params.method,
      identifier: normalized.normalized,
      result: meta?.result ?? (next === "authenticated" ? "success" : next === "failed" ? "failed" : "info"),
      error: meta?.error,
      details: { nextStatus: next, ...(meta?.details ?? {}) },
    });
  };

  setStatus("account_resolution_in_progress", { result: "started" });
  const resolved = await resolveUserByIdentifier(normalized.normalized, attemptId, params.method, params.userId);

  setStatus("profile_loading", { result: "success", details: { userId: resolved.userId, profileStatus: resolved.profileStatus } });
  setStatus("role_loading", { result: "started", details: { role: resolved.role, companyId: resolved.companyId } });

  const destination = getRoleDestination(resolved.role);

  // INSTANT REDIRECT for internal staff: skip price-tier hop (not used by admin/staff dashboards).
  // Cache is written synchronously with priceTier=null; refreshed in background.
  if (resolved.isInternalStaff) {
    writeAuthCache({
      userId: resolved.userId,
      companyId: resolved.companyId,
      role: resolved.role,
      priceTier: null,
    });
    setStatus("authenticated", {
      result: "success",
      details: { userId: resolved.userId, destination, role: resolved.role, fastPath: true },
    });
    // Fire-and-forget price tier hydration for any later staff-as-buyer scenarios.
    void fetchPriceTier(resolved.companyId).then((priceTier) => {
      writeAuthCache({
        userId: resolved.userId,
        companyId: resolved.companyId,
        role: resolved.role,
        priceTier,
      });
    }).catch(() => {});
  } else {
    const priceTier = await fetchPriceTier(resolved.companyId);
    writeAuthCache({
      userId: resolved.userId,
      companyId: resolved.companyId,
      role: resolved.role,
      priceTier,
    });
    setStatus("authenticated", {
      result: "success",
      details: { userId: resolved.userId, destination, role: resolved.role },
    });
  }

  return {
    attemptId,
    identifier: normalized.normalized,
    role: resolved.role,
    companyId: resolved.companyId,
    destination,
    userId: resolved.userId,
  };
}

// ─── AUTH SPLIT — B2B Client Login vs Oasis Staff Login ─────────────────────
// Buyer and staff login are separate authentication SURFACES, but must never
// fork the backend identity/authorization system: both call the same
// completeAuthLogin() above, and the resolved role is the single source of
// truth. This section only adds a per-surface authorization boundary on top
// of it. A resolved role of the wrong kind fails closed here rather than
// silently landing on the other surface's destination just because the
// Supabase auth step itself succeeded.
export type RequiredMembership = "staff" | "buyer";

/**
 * Fails closed when a resolved role does not belong to the membership kind
 * a login surface requires. Pure and independent of completeAuthLogin's
 * network calls so it can be unit-tested directly.
 */
export function assertMembership(role: string | null, required?: RequiredMembership): void {
  if (!required) return;
  if (required === "staff" && !isStaffRole(role)) {
    throw new AuthFlowError("STAFF_MEMBERSHIP_REQUIRED", USER_MESSAGE_BY_CODE.STAFF_MEMBERSHIP_REQUIRED, "failed");
  }
  if (required === "buyer" && !isStorefrontRole(role)) {
    throw new AuthFlowError("BUYER_MEMBERSHIP_REQUIRED", USER_MESSAGE_BY_CODE.BUYER_MEMBERSHIP_REQUIRED, "failed");
  }
}

export interface RedirectAfterAuthParams {
  identity: string;
  method: AuthAttemptMethod;
  userId?: string;
  attemptId?: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  setStatus: (
    next: AuthStatus,
    meta?: { result?: "started" | "success" | "failed" | "info"; error?: string | null; details?: Record<string, unknown> },
  ) => void;
  /** Scopes this call to one login surface. Omit for the neutral entry point. */
  requiredMembership?: RequiredMembership;
}

/**
 * Shared post-authentication redirect for both /buyer/login and /staff/login.
 * Resolves the account exactly once (completeAuthLogin), enforces the
 * calling surface's membership requirement, and navigates to the
 * server-role-derived destination only. There is no identity-based
 * (email/phone) branch here by design: Admin/Super Admin routing must come
 * from getRoleDestination()'s role lookup alone, never a hard-coded caller
 * identity.
 *
 * Unresolved-account handling (no role / pending approval) is also
 * surface-aware: on the staff surface it never forwards into B2B buyer
 * onboarding (see getPostLoginRedirectOnError) — it fails closed and lets
 * the bounded AuthFlowError propagate to the caller instead.
 */
export async function redirectAfterAuth(params: RedirectAfterAuthParams): Promise<void> {
  const currentAttemptId = params.attemptId ?? createAuthAttemptId();
  const normalized = normalizeIdentifier(params.identity);

  let result: CompletedAuthResult;
  try {
    result = await completeAuthLogin({
      identity: normalized.normalized,
      method: params.method,
      userId: params.userId,
      attemptId: currentAttemptId,
      setStatus: params.setStatus,
    });
    assertMembership(result.role, params.requiredMembership);
  } catch (error) {
    const unresolvedDestination = getPostLoginRedirectOnError(error, params.requiredMembership);
    if (unresolvedDestination) {
      logAuthEvent("REDIRECT_STARTED", {
        attemptId: currentAttemptId,
        method: params.method,
        identifier: normalized.normalized,
        result: "info",
        details: { destination: unresolvedDestination, reason: "unresolved_account" },
      });
      params.navigate(unresolvedDestination, { replace: true });
      logAuthEvent("REDIRECT_SUCCESS", {
        attemptId: currentAttemptId,
        method: params.method,
        identifier: normalized.normalized,
        result: "success",
        details: { destination: unresolvedDestination },
      });
      return;
    }
    if (error instanceof AuthFlowError) throw error;
    const message = error instanceof Error ? error.message : "account_resolution_failed";
    throw new Error(`ACCOUNT_RESOLUTION_FAILED:${message}`);
  }

  logAuthEvent("REDIRECT_STARTED", {
    attemptId: currentAttemptId,
    method: params.method,
    identifier: result.identifier,
    result: "started",
    details: { destination: result.destination, role: result.role },
  });

  try {
    params.navigate(result.destination, { replace: true });
    logAuthEvent("REDIRECT_SUCCESS", {
      attemptId: currentAttemptId,
      method: params.method,
      identifier: result.identifier,
      result: "success",
      details: { destination: result.destination },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "redirect_failed";
    logAuthEvent("REDIRECT_FAILED", {
      attemptId: currentAttemptId,
      method: params.method,
      identifier: result.identifier,
      result: "failed",
      error: message,
      details: { destination: result.destination },
    });
    throw new Error(`REDIRECT_FAILED:${message}`);
  }
}