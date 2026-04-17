import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Detects auth-related errors in URL query/hash params (e.g. Supabase OAuth
 * callback failures) and surfaces a clear toast. Clears params after firing
 * so the toast doesn't repeat on subsequent renders.
 */
export default function AuthErrorListener() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(
      location.hash.startsWith("#") ? location.hash.slice(1) : location.hash
    );

    const serverError = search.get("server_error") || hash.get("error");
    const errorCode = search.get("error_code") || hash.get("error_code");
    const errorDescription =
      search.get("error_description") || hash.get("error_description");

    if (!serverError && !errorCode && !errorDescription) return;

    const blob = `${serverError ?? ""} ${errorCode ?? ""} ${errorDescription ?? ""}`.toLowerCase();
    const isGoogleOAuth = blob.includes("google") || blob.includes("oauth") || blob.includes("provider");

    if (isGoogleOAuth || location.pathname.startsWith("/welcome")) {
      toast.error("Google configuration in progress. Please use WhatsApp login for the demo.", {
        duration: 8000,
      });
      navigate("/login", { replace: true });
      return;
    }

    toast.error("Auth configuration mismatch. Please check Supabase Site URL.", {
      description: errorDescription || serverError || errorCode || undefined,
      duration: 8000,
    });

    // Strip error params so the toast doesn't fire repeatedly
    navigate(location.pathname, { replace: true });
  }, [location, navigate]);

  return null;
}
