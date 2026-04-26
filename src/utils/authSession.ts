import { supabase } from "@/integrations/supabase/client";
import { clearAuthCache } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent } from "@/lib/auth-logging";

function getSupabaseStorageKeys() {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith("sb-") && key.includes("auth-token"));
  } catch {
    return [] as string[];
  }
}

export async function signOutAndClearSession() {
  const attemptId = createAuthAttemptId();
  logAuthEvent("LOGOUT_STARTED", {
    attemptId,
    method: "logout",
    identifier: null,
    result: "started",
  });

  const storageKeys = getSupabaseStorageKeys();

  try {
    await supabase.auth.signOut();
  } finally {
    clearAuthCache();

    storageKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    try {
      sessionStorage.removeItem("oasis_welcomed");
    } catch {}

    logAuthEvent("LOGOUT_SUCCESS", {
      attemptId,
      method: "logout",
      identifier: null,
      result: "success",
    });
  }
}
