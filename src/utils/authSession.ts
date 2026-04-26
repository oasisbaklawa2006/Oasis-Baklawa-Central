import { supabase } from "@/integrations/supabase/client";
import { clearAuthCache } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent } from "@/lib/auth-logging";

function getSupabaseStorageKeys() {
  try {
    return Object.keys(localStorage).filter(
      (key) => key.startsWith("sb-") && key.includes("auth-token"),
    );
  } catch {
    return [] as string[];
  }
}

function getOasisAuthLocalKeys() {
  try {
    return Object.keys(localStorage).filter(
      (key) => key.startsWith("oasis_auth") || key === "oasis_welcomed",
    );
  } catch {
    return [] as string[];
  }
}

function getOasisAuthSessionKeys() {
  try {
    return Object.keys(sessionStorage).filter((key) => key.startsWith("oasis_"));
  } catch {
    return [] as string[];
  }
}

function destroyMsg91Widget() {
  if (typeof document === "undefined") return;
  try {
    document.querySelectorAll(
      "[id^='msg91'], [class*='msg91'], iframe[src*='msg91'], #msg91-otp-provider",
    ).forEach((node) => node.parentElement?.removeChild(node));
  } catch {}
  try {
    delete (window as any).initSendOTP;
  } catch {}
}

/**
 * Single source of truth for logout. Always:
 *   1. Calls supabase.auth.signOut({ scope: 'local' }) (we keep other tabs alone unless asked).
 *   2. Clears the AuthCache.
 *   3. Clears every sb-*-auth-token key (covers project rotation).
 *   4. Clears oasis_auth* localStorage and oasis_* sessionStorage keys.
 *   5. Tears down the MSG91 widget so a re-login starts clean.
 *   6. Logs LOGOUT_STARTED / LOGOUT_SUCCESS / LOGOUT_FAILED with attemptId correlation.
 */
export async function signOutAndClearSession(opts: { reason?: string } = {}) {
  const attemptId = createAuthAttemptId();
  logAuthEvent("LOGOUT_STARTED", {
    attemptId,
    method: "logout",
    identifier: null,
    result: "started",
    details: { reason: opts.reason ?? "user_initiated" },
  });

  const sbKeys = getSupabaseStorageKeys();
  const oasisLocalKeys = getOasisAuthLocalKeys();
  const oasisSessionKeys = getOasisAuthSessionKeys();

  let signOutError: string | null = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    signOutError = err instanceof Error ? err.message : "signout_failed";
  }

  clearAuthCache();

  sbKeys.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
  oasisLocalKeys.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
  oasisSessionKeys.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch {}
  });

  destroyMsg91Widget();

  if (signOutError) {
    logAuthEvent("LOGOUT_FAILED", {
      attemptId,
      method: "logout",
      identifier: null,
      result: "failed",
      error: signOutError,
      details: { clearedKeys: sbKeys.length + oasisLocalKeys.length + oasisSessionKeys.length },
    });
    return;
  }

  logAuthEvent("LOGOUT_SUCCESS", {
    attemptId,
    method: "logout",
    identifier: null,
    result: "success",
    details: { clearedKeys: sbKeys.length + oasisLocalKeys.length + oasisSessionKeys.length },
  });
}
