import { supabase } from "@/integrations/supabase/client";
import { fetchAuthRoleRecord, getRoleDestination, isInternalStaffUser, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";
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
  | "user_resolution_in_progress"
  | "session_creation_in_progress"
  | "role_loading"
  | "authenticated"
  | "failed"
  | "fallback_to_email";

export interface AuthCache {
  userId: string;
  companyId: string | null;
  role: string | null;
  priceTier: string | null;
}

export type ResolvedUserStatus = "approved" | "pending" | "blocked" | "missing_role" | "not_registered" | "duplicate";

export interface ResolvedUserRecord {
  userId: string;
  role: string | null;
  companyId: string | null;
  status: ResolvedUserStatus;
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
  ACCOUNT_PENDING: "Account pending approval.",
  ACCOUNT_BLOCKED: "Account blocked. Please contact support.",
  ROLE_NOT_ASSIGNED: "Role not assigned. Please contact an administrator.",
  DUPLICATE_IDENTITY: "Duplicate identity records found. Please contact support.",
  SESSION_CREATE_FAILED: "Session could not be created.",
  DASHBOARD_LOAD_FAILED: "Dashboard could not be loaded.",
  AUTH_UNAUTHORIZED: "You are not authorized to access this app.",
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
  } catch {}
}

export function clearAuthCache() {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export function createAuthStateController(initialStatus: AuthStatus = "idle") {
  let status = initialStatus;
  const timers = new Set<ReturnType<typeof setTimeout>>();
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
    registerTimer: (timer: ReturnType<typeof setTimeout>) => {
      timers.add(timer);
      return timer;
    },
    clearTimer: (timer: ReturnType<typeof setTimeout> | null | undefined) => {
      if (!timer) return;
      clearTimeout(timer);
      timers.delete(timer);
    },
    clearAllTimers: () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
    createAbortController: () => {
      const controller = new AbortController();
      abortControllers.add(controller);
      return controller;
    },
    finalize: () => {
      timers.forEach((timer) => clearTimeout(timer));
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

async function resolveUserByIdentifier(identifier: string, attemptId: string, method: AuthAttemptMethod): Promise<ResolvedUserRecord> {
  const normalized = normalizeIdentifier(identifier);
  logAuthEvent("USER_RESOLUTION_STARTED", {
    attemptId,
    method,
    identifier: normalized.normalized,
    result: "started",
  });

  const baseSelect = "id, role, company_id, is_active, phone, mobile_number, email";
  let userMatches:
    | Array<{ id: string; role: string | null; company_id: string | null; is_active: boolean | null; phone: string | null; mobile_number: string | null; email: string | null }>
    | null = null;

  if (normalized.kind === "email") {
    const { data, error } = await supabase
      .from("users")
      .select(baseSelect)
      .ilike("email", normalized.normalized)
      .limit(5);

    if (error) {
      logAuthEvent("USER_RESOLUTION_FAILED", {
        attemptId,
        method,
        identifier: normalized.normalized,
        result: "failed",
        error: error.message,
      });
      throw new AuthFlowError("NETWORK_ERROR", error.message);
    }

    userMatches = data;
  } else {
    const phone = normalizePhone(identifier);
    const pattern = `%${phone.last10}%`;

    const { data, error } = await supabase
      .from("users")
      .select(baseSelect)
      .or(
        `phone.ilike.${pattern},mobile_number.ilike.${pattern},secondary_phones.cs.{${phone.last10}}`,
      )
      .limit(10);

    if (error) {
      logAuthEvent("USER_RESOLUTION_FAILED", {
        attemptId,
        method,
        identifier: normalized.normalized,
        result: "failed",
        error: error.message,
      });
      throw new AuthFlowError("NETWORK_ERROR", error.message);
    }

    userMatches = data;
  }

  const dedupedUsers = dedupeRecords(userMatches).filter((row) => {
    if (normalized.kind === "email") {
      return (row.email ?? "").trim().toLowerCase() === normalized.normalized;
    }

    const phoneVariants = [row.phone, row.mobile_number, ...(row as any).secondary_phones ?? []]
      .filter(Boolean)
      .map((value) => normalizePhone(String(value)).last10)
      .filter(Boolean);

    return phoneVariants.includes(normalized.last10 ?? "");
  });

  if (!dedupedUsers.length) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: "not_registered",
    });
    throw new AuthFlowError("USER_NOT_REGISTERED", USER_MESSAGE_BY_CODE.USER_NOT_REGISTERED);
  }

  if (dedupedUsers.length > 1) {
    logAuthEvent("USER_RESOLUTION_FAILED", {
      attemptId,
      method,
      identifier: normalized.normalized,
      result: "failed",
      error: `duplicate_records:${dedupedUsers.length}`,
    });
    throw new AuthFlowError("DUPLICATE_IDENTITY", USER_MESSAGE_BY_CODE.DUPLICATE_IDENTITY);
  }

  const matchedUser = dedupedUsers[0];

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
    status: "approved",
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

  setStatus("user_resolution_in_progress", { result: "started" });
  const resolved = await resolveUserByIdentifier(normalized.normalized, attemptId, params.method);

  if (params.userId && params.userId !== resolved.userId) {
    throw new AuthFlowError("AUTH_UNAUTHORIZED", "Verified identity does not match the authenticated user.");
  }

  setStatus("role_loading", { result: "started", details: { role: resolved.role, companyId: resolved.companyId } });

  const priceTier = await fetchPriceTier(resolved.companyId);
  writeAuthCache({
    userId: resolved.userId,
    companyId: resolved.companyId,
    role: resolved.role,
    priceTier,
  });

  const destination = isStorefrontRole(resolved.role) && resolved.companyId
    ? "/welcome"
    : getRoleDestination(resolved.role);

  setStatus("authenticated", {
    result: "success",
    details: { userId: resolved.userId, destination, role: resolved.role },
  });

  return {
    attemptId,
    identifier: normalized.normalized,
    role: resolved.role,
    companyId: resolved.companyId,
    destination,
    userId: resolved.userId,
  };
}
