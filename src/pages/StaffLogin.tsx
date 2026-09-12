import { useEffect, useMemo, useRef, useState } from "react";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import { createAuthStateController, getCustomerAuthUserMessage, readAuthCache, redirectAfterAuth, type AuthStatus } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { normalizeIdentifier } from "@/lib/auth-identity";
import { signOutAndClearSession } from "@/utils/authSession";

const StaffLogin = () => {
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef(createAuthStateController("idle"));
  const attemptRef = useRef<{ id: string; method: AuthAttemptMethod; identifier: string | null } | null>(null);

  const isMinting = useMemo(
    () => {
      const minting = ["verification_success", "session_creation_in_progress", "account_resolution_in_progress", "profile_loading", "role_loading"].includes(authStatus);
      if (!minting) return false;
      // Skip the "Securing your Oasis session" overlay when role is already cached locally.
      const cached = typeof window !== "undefined" ? readAuthCache() : null;
      return !(cached && cached.role);
    },
    [authStatus],
  );

  const updateStatus = (
    next: AuthStatus,
    meta?: { result?: "started" | "success" | "failed" | "info"; error?: string | null; details?: Record<string, unknown> },
  ) => {
    const currentAttempt = attemptRef.current;
    controllerRef.current.setStatus(next, currentAttempt ? {
      attemptId: currentAttempt.id,
      method: currentAttempt.method,
      identifier: currentAttempt.identifier,
      ...meta,
    } : undefined);
    setAuthStatus(next);
  };

  const finalizeFailure = async (message: string, finalState: AuthStatus = "failed", shouldSignOut = false) => {
    controllerRef.current.clearAllTimers();
    controllerRef.current.finalize();
    if (shouldSignOut) {
      await signOutAndClearSession();
    }
    updateStatus(finalState, { result: "failed", error: message });
    setStatusMessage(message);
    setLoading(false);
  };

  const runRedirectAfterAuth = async (identity: string, method: AuthAttemptMethod, userId?: string, attemptId?: string) => {
    // Staff surface only: a resolved role that isn't an internal staff role
    // fails closed here. Authenticating on this page never infers or grants
    // a B2B buyer membership.
    await redirectAfterAuth({
      identity,
      method,
      userId,
      attemptId,
      navigate,
      setStatus: (next, meta) => updateStatus(next, meta),
      requiredMembership: "staff",
    });
  };

  // ── Manual Magic-Link bypass ──
  // Password-reset emails redirect here with ?manual_auth=true. Bypass
  // onAuthStateChange and manually extract the access/refresh tokens from the
  // URL hash, then call supabase.auth.setSession() directly. This sidesteps
  // the SMTP redirection conflict that was causing "Auth configuration mismatch".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const isManual = url.searchParams.get("manual_auth") === "true";
    if (!isManual) return;

    // Tokens come back in the URL fragment from Supabase magic-link emails.
    const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash || "");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      // Nothing to do — fall back to normal flow silently.
      return;
    }

    (async () => {
      setLoading(true);
      setStatusMessage("Authenticating via secure magic link…");
      try {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) {
          toast.error("Magic link session failed. Please request a new link.");
          setLoading(false);
          return;
        }
        // Clear sensitive tokens from URL
        window.history.replaceState({}, "", url.pathname);
        const identity = data.session.user.email || data.session.user.phone || data.session.user.id;
        await runRedirectAfterAuth(identity, "session_restore", data.session.user.id);
      } catch (err) {
        // setSession() above already established a real Supabase session before
        // this failure (wrong-surface membership, or an unresolved/pending
        // staff identity failing closed) — a session this restore never earned
        // staff access for must not be left reusable.
        await signOutAndClearSession();
        toast.error(getCustomerAuthUserMessage(err));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateStatus("entering_identifier", { result: "info" });
    setStatusMessage(null);
    return () => {
      controllerRef.current.finalize();
    };
  }, []);

  const handleEmailLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    const attemptId = createAuthAttemptId();
    const method: AuthAttemptMethod = "email_password";
    const identifier = normalizeIdentifier(trimmedEmail).normalized;
    attemptRef.current = { id: attemptId, method, identifier };
    setLoading(true);
    setStatusMessage(null);

    logAuthEvent("AUTH_START", {
      attemptId,
      method,
      identifier,
      result: "started",
    });
    updateStatus("session_creation_in_progress", { result: "started" });
    logAuthEvent("SESSION_CREATE_STARTED", {
      attemptId,
      method,
      identifier,
      result: "started",
    });

    const { error, data } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

    if (error || !data.user) {
      const message = error?.message || "session_create_failed";
      logAuthEvent("SESSION_CREATE_FAILED", {
        attemptId,
        method,
        identifier,
        result: "failed",
        error: message,
      });
      await finalizeFailure(getCustomerAuthUserMessage(error), "failed");
      return;
    }

    logAuthEvent("SESSION_CREATE_SUCCESS", {
      attemptId,
      method,
      identifier,
      result: "success",
      details: { userId: data.user.id },
    });

    try {
      await runRedirectAfterAuth(trimmedEmail, method, data.user.id, attemptId);
      setLoading(false);
    } catch (error) {
      await finalizeFailure(getCustomerAuthUserMessage(error), "failed", true);
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) toast.error("We couldn't send a reset email. Please check your email address and try again.");
    else toast.success("Password reset email sent.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background">
      {isMinting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <Loader2 size={42} className="animate-spin text-primary" />
          <p className="mt-5 text-base font-medium text-primary">Securing your Oasis session...</p>
        </div>
      )}

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" width={134} height={96} fetchPriority="high" decoding="async" className="h-10 sm:h-12 w-auto mx-auto object-contain" />
          <h1 className="text-3xl text-foreground">Oasis Staff</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Oasis Baklawa account</p>
        </div>

        <div className="bg-card rounded-2xl p-6 space-y-5 border border-border shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <Input
                type="email"
                placeholder="you@oasisbaklawa.com"
                className="rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  className="rounded-xl pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleEmailLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={() => void handleEmailLogin()}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? "Signing in..." : "Login"}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              Forgot password?{" "}
              <button onClick={() => void handleResetPassword()} className="text-primary font-semibold hover:underline">
                Reset it
              </button>
            </p>
          </div>

          {statusMessage && !isMinting && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${authStatus === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>
              {statusMessage}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Not an Oasis employee?{" "}
            <button onClick={() => navigate("/buyer/login")} className="text-primary font-semibold hover:underline">
              Go to B2B Client Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;
