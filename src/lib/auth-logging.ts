export type AuthAttemptMethod =
  | "mobile_otp"
  | "email_password"
  | "google_oauth"
  | "apple_oauth"
  | "whatsapp"
  | "oauth"
  | "session_restore"
  | "logout";

export type AuthLogEvent =
  | "AUTH_START"
  | "EMAIL_LOGIN_STARTED"
  | "EMAIL_LOGIN_SUCCESS"
  | "EMAIL_LOGIN_FAILED"
  | "GOOGLE_LOGIN_STARTED"
  | "GOOGLE_LOGIN_SUCCESS"
  | "GOOGLE_LOGIN_FAILED"
  | "APPLE_LOGIN_STARTED"
  | "APPLE_LOGIN_SUCCESS"
  | "APPLE_LOGIN_FAILED"
  | "OTP_REQUEST_STARTED"
  | "OTP_REQUEST_SUCCESS"
  | "OTP_REQUEST_FAILED"
  | "OTP_VERIFY_STARTED"
  | "OTP_VERIFY_SUCCESS"
  | "OTP_VERIFY_FAILED"
  | "AUTH_TIMEOUT_TRIGGERED"
  | "ACCOUNT_LINK_RESOLUTION_STARTED"
  | "ACCOUNT_LINK_RESOLUTION_SUCCESS"
  | "ACCOUNT_LINK_RESOLUTION_FAILED"
  | "USER_RESOLUTION_STARTED"
  | "USER_RESOLUTION_SUCCESS"
  | "USER_RESOLUTION_FAILED"
  | "PROFILE_FETCH_STARTED"
  | "PROFILE_FETCH_SUCCESS"
  | "PROFILE_FETCH_FAILED"
  | "ROLE_FETCH_STARTED"
  | "ROLE_FETCH_SUCCESS"
  | "ROLE_FETCH_FAILED"
  | "SESSION_CREATE_STARTED"
  | "SESSION_CREATE_SUCCESS"
  | "SESSION_CREATE_FAILED"
  | "SESSION_HYDRATION_STARTED"
  | "SESSION_HYDRATION_SUCCESS"
  | "SESSION_HYDRATION_FAILED"
  | "AUTH_STATE_UPDATED"
  | "REDIRECT_STARTED"
  | "REDIRECT_SUCCESS"
  | "REDIRECT_FAILED"
  | "LOGOUT_STARTED"
  | "LOGOUT_SUCCESS"
  | "LOGOUT_FAILED";

export interface AuthLogContext {
  attemptId: string;
  method: AuthAttemptMethod;
  identifier?: string | null;
  result?: "started" | "success" | "failed" | "info";
  error?: string | null;
  details?: Record<string, unknown>;
  currentRoute?: string | null;
}

export function createAuthAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentRoute() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isAuthDebugEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === "true";
}

function maskIdentifier(identifier?: string | null) {
  if (!identifier) return null;
  if (identifier.includes("@")) {
    const [name, domain] = identifier.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const digits = identifier.replace(/\D/g, "");
  if (digits.length >= 6) return `***${digits.slice(-4)}`;
  return "***";
}

export function logAuthEvent(event: AuthLogEvent, context: AuthLogContext) {
  if (!isAuthDebugEnabled()) return;

  const payload = {
    event,
    attemptId: context.attemptId,
    method: context.method,
    identifier: maskIdentifier(context.identifier),
    currentRoute: context.currentRoute ?? getCurrentRoute(),
    timestamp: new Date().toISOString(),
    result: context.result ?? "info",
    error: context.error ?? null,
    ...(context.details ? { details: context.details } : {}),
  };

  const level = payload.result === "failed" ? "error" : payload.result === "success" ? "info" : "log";
  console[level](`[auth] ${event}`, payload);
}
