export type AuthAttemptMethod = "mobile_otp" | "email_password" | "whatsapp" | "oauth" | "session_restore" | "logout";

export type AuthLogEvent =
  | "AUTH_START"
  | "OTP_REQUEST_STARTED"
  | "OTP_REQUEST_SUCCESS"
  | "OTP_REQUEST_FAILED"
  | "OTP_VERIFY_STARTED"
  | "OTP_VERIFY_SUCCESS"
  | "OTP_VERIFY_FAILED"
  | "AUTH_TIMEOUT_TRIGGERED"
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
  | "AUTH_STATE_UPDATED"
  | "REDIRECT_STARTED"
  | "REDIRECT_SUCCESS"
  | "REDIRECT_FAILED"
  | "LOGOUT_STARTED"
  | "LOGOUT_SUCCESS";

export interface AuthLogContext {
  attemptId: string;
  method: AuthAttemptMethod;
  identifier?: string | null;
  result?: "started" | "success" | "failed" | "info";
  error?: string | null;
  details?: Record<string, unknown>;
}

export function createAuthAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logAuthEvent(event: AuthLogEvent, context: AuthLogContext) {
  const payload = {
    event,
    attemptId: context.attemptId,
    method: context.method,
    identifier: context.identifier ?? null,
    timestamp: new Date().toISOString(),
    result: context.result ?? "info",
    error: context.error ?? null,
    ...(context.details ? { details: context.details } : {}),
  };

  const level = payload.result === "failed" ? "error" : payload.result === "success" ? "info" : "log";
  console[level](`[auth] ${event}`, payload);
}
