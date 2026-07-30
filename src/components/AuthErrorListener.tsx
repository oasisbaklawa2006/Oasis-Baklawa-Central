import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthCache } from "@/lib/auth-flow";

function isInvalidRefreshTokenError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const blob = `${candidate?.code ?? ""} ${candidate?.message ?? ""}`.toLowerCase();
  return blob.includes("refresh_token_not_found")
    || blob.includes("invalid refresh token")
    || blob.includes("refresh token not found");
}

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") && key.includes("auth-token")) {
      window.localStorage.removeItem(key);
    }
  }

  clearAuthCache();
}

/**
 * Surfaces OAuth callback failures and recovers from stale Supabase refresh
 * tokens. Invalid refresh state is cleared once before returning to login.
 */
export default function AuthErrorListener() {
  const location = useLocation();
  const navigate = useNavigate();
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(async ({ error }) => {
      if (!mounted || !error || !isInvalidRefreshTokenError(error) || recoveryStartedRef.current) return;

      recoveryStartedRef.current = true;
      clearSupabaseAuthStorage();

      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Local storage has already been cleared; remote sign-out is not required.
      }

      if (!mounted) return;
      navigate("/login?reason=session_expired", { replace: true });
    }).catch((error: unknown) => {
      if (!mounted || !isInvalidRefreshTokenError(error) || recoveryStartedRef.current) return;
      recoveryStartedRef.current = true;
      clearSupabaseAuthStorage();
      navigate("/login?reason=session_expired", { replace: true });
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(
      location.hash.startsWith("#") ? location.hash.slice(1) : location.hash,
    );

    const reason = search.get("reason");
    if (reason === "session_expired") {
      toast.error("Your session expired. Please sign in again.", { duration: 6000 });
      search.delete("reason");
      const nextSearch = search.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
      return;
    }

    const serverError = search.get("server_error") || hash.get("error");
    const errorCode = search.get("error_code") || hash.get("error_code");
    const errorDescription = search.get("error_description") || hash.get("error_description");

    if (!serverError && !errorCode && !errorDescription) return;

    const blob = `${serverError ?? ""} ${errorCode ?? ""} ${errorDescription ?? ""}`.toLowerCase();
    const isGoogleOAuth = blob.includes("google") || blob.includes("oauth") || blob.includes("provider");

    if (isGoogleOAuth || location.pathname.startsWith("/welcome")) {
      toast.error("We couldn’t complete sign-in. Please use mobile verification or email, or contact support@oasisbaklawa.com.", {
        duration: 8000,
      });
      navigate("/login", { replace: true });
      return;
    }

    toast.error("Auth configuration mismatch. Please check Supabase Site URL.", {
      description: errorDescription || serverError || errorCode || undefined,
      duration: 8000,
    });

    navigate(location.pathname, { replace: true });
  }, [location, navigate]);

  return null;
}
