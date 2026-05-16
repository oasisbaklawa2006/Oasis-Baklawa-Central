import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogIn, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import { createAuthStateController, completeAuthLogin, getAuthUserMessage, readAuthCache, type AuthStatus } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { normalizeIdentifier } from "@/lib/auth-identity";
import { signOutAndClearSession } from "@/utils/authSession";

const MSG91_WIDGET_ID = "3664766e464b383030383331";
const MSG91_TOKEN_AUTH = "509994T6SRbi4LqM69ea72d0P1";
const MSG91_PROVIDER_SCRIPT_ID = "msg91-otp-provider";

type AuthTab = "msg91" | "email";

declare global {
  interface Window {
    initSendOTP?: (cfg: Record<string, unknown>) => void;
  }
}

function mapOtpErrorMessage(rawMessage?: string | null) {
  const normalized = rawMessage ?? "";
  const stageMessage = normalized.includes(":") ? normalized.split(":").slice(1).join(":") : normalized;
  const message = stageMessage.toLowerCase();
  if (message.includes("phone_missing_from_widget_and_edge")) return "Phone number was missing after verification. Please retry.";
  if (message.includes("token_hash_missing")) return "Verification succeeded, but session token generation failed. Please retry.";
  if (message.includes("user_id_missing")) return "Verification succeeded, but account binding failed. Please retry.";
  if (message.includes("provider_not_linked") || message.includes("phone_not_linked")) return "This phone number is not linked to an approved account.";
  if (message.includes("expired")) return "OTP expired. Please request a new code.";
  if (message.includes("invalid")) return "OTP invalid. Please enter the correct code and try again.";
  if (message.includes("network")) return "Network error. Please check your connection and try again.";
  return "OTP verification failed. Please try again.";
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractMsg91AccessToken(payload: any) {
  return firstNonEmptyString(
    typeof payload === "string" ? payload : null,
    payload?.["access-token"],
    payload?.accessToken,
    payload?.access_token,
    typeof payload?.message === "string" ? payload.message : null,
    payload?.message?.["access-token"],
    payload?.message?.accessToken,
    payload?.message?.access_token,
    payload?.data?.message,
    payload?.data?.["access-token"],
    payload?.data?.accessToken,
    payload?.data?.access_token,
  );
}

function extractMsg91Phone(payload: any) {
  return firstNonEmptyString(
    payload?.mobile,
    payload?.phone,
    payload?.identifier,
    payload?.number,
    payload?.msisdn,
    payload?.message?.mobile,
    payload?.message?.phone,
    payload?.message?.identifier,
    payload?.message?.number,
    payload?.message?.msisdn,
    payload?.data?.mobile,
    payload?.data?.phone,
    payload?.data?.identifier,
    payload?.data?.number,
    payload?.data?.msisdn,
    payload?.data?.user?.mobile,
    payload?.data?.user?.phone,
  );
}

function maskSecret(value?: string | null) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function sanitizeAuthDebugPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeAuthDebugPayload(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
      const normalizedKey = key.toLowerCase();
      if (["access-token", "accesstoken", "access_token", "token_hash", "tokenhash"].includes(normalizedKey)) {
        return [key, maskSecret(typeof entryValue === "string" ? entryValue : null)];
      }
      return [key, sanitizeAuthDebugPayload(entryValue)];
    }),
  );
}

const Login = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AuthTab>("msg91");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMsg91Ready, setIsMsg91Ready] = useState(false);
  const controllerRef = useRef(createAuthStateController("idle"));
  const attemptRef = useRef<{ id: string; method: AuthAttemptMethod; identifier: string | null } | null>(null);
  const providerLoadRef = useRef<Promise<void> | null>(null);

  const isMinting = useMemo(
    () => {
      const minting = ["verifying_otp", "verification_success", "session_creation_in_progress", "account_resolution_in_progress", "profile_loading", "role_loading"].includes(authStatus);
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

  const redirectAfterAuth = async (
    identity: string,
    method: AuthAttemptMethod,
    userId?: string,
    attemptId?: string,
  ) => {
    const currentAttemptId = attemptId ?? createAuthAttemptId();
    const normalized = normalizeIdentifier(identity);

    let result;
    try {
      result = await completeAuthLogin({
        identity: normalized.normalized,
        method,
        userId,
        attemptId: currentAttemptId,
        setStatus: (next, meta) => updateStatus(next, meta),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "account_resolution_failed";
      throw new Error(`ACCOUNT_RESOLUTION_FAILED:${message}`);
    }

    logAuthEvent("REDIRECT_STARTED", {
      attemptId: currentAttemptId,
      method,
      identifier: result.identifier,
      result: "started",
      details: { destination: result.destination, role: result.role },
    });

    // Admin express lane — use react-router native navigation to avoid Safari hard-refresh bugs
    const idLower = (normalized.normalized || identity || "").toLowerCase();
    const isAdminExpress =
      idLower === "admin@oasisbaklawa.com" ||
      idLower === "9891162212" ||
      idLower === "+919891162212" ||
      idLower === "919891162212" ||
      String(result.role || "").toLowerCase() === "admin" ||
      String(result.role || "").toUpperCase() === "SUPER_ADMIN";

    try {
      const target = isAdminExpress ? "/admin/cmd-war-room" : result.destination;
      navigate(target, { replace: true });
      logAuthEvent("REDIRECT_SUCCESS", {
        attemptId: currentAttemptId,
        method,
        identifier: result.identifier,
        result: "success",
        details: { destination: result.destination },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "redirect_failed";
      logAuthEvent("REDIRECT_FAILED", {
        attemptId: currentAttemptId,
        method,
        identifier: result.identifier,
        result: "failed",
        error: message,
        details: { destination: result.destination },
      });
      throw new Error(`REDIRECT_FAILED:${message}`);
    }
  };

  const ensureMsg91Provider = useCallback(() => {
    if (typeof window === "undefined") return Promise.resolve();
    if (typeof window.initSendOTP === "function") {
      setIsMsg91Ready(true);
      return Promise.resolve();
    }
    if (providerLoadRef.current) return providerLoadRef.current;

    providerLoadRef.current = new Promise<void>((resolve, reject) => {
      const markReadyWhenAvailable = () => {
        if (typeof window.initSendOTP === "function") {
          setIsMsg91Ready(true);
          resolve();
          return true;
        }
        return false;
      };

      const existing = document.getElementById(MSG91_PROVIDER_SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        if (markReadyWhenAvailable()) return;
        const poll = window.setInterval(() => {
          if (markReadyWhenAvailable()) window.clearInterval(poll);
        }, 250);
        existing.addEventListener("error", () => {
          window.clearInterval(poll);
          providerLoadRef.current = null;
          reject(new Error("msg91_provider_load_failed"));
        }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = MSG91_PROVIDER_SCRIPT_ID;
      script.src = "https://verify.msg91.com/otp-provider.js";
      script.async = true;
      script.onload = () => {
        if (markReadyWhenAvailable()) return;
        const poll = window.setInterval(() => {
          if (markReadyWhenAvailable()) window.clearInterval(poll);
        }, 250);
      };
      script.onerror = () => {
        providerLoadRef.current = null;
        setIsMsg91Ready(false);
        reject(new Error("msg91_provider_load_failed"));
      };
      document.body.appendChild(script);
    });

    return providerLoadRef.current;
  }, []);

  // ── PART 3: Manual Magic-Link bypass ──
  // When the magic link redirects with ?manual_auth=true, completely bypass
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
        await redirectAfterAuth(identity, "session_restore", data.session.user.id);
      } catch (err: any) {
        toast.error(err?.message || "Manual auth failed");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void ensureMsg91Provider().catch(() => {
      setStatusMessage("Mobile verification is unavailable right now. Please use Email login.");
      setActiveTab("email");
    });

    return () => {
      controllerRef.current.finalize();
    };
  }, [ensureMsg91Provider]);

  useEffect(() => {
    updateStatus("entering_identifier", { result: "info", details: { tab: activeTab } });
    if (activeTab === "msg91") {
      setStatusMessage(null);
    }
  }, [activeTab]);

  const teardownMsg91Widget = () => {
    if (typeof document === "undefined") return;
    try {
      document
        .querySelectorAll(
          "[id^='msg91'], [class*='msg91'], iframe[src*='msg91']",
        )
        .forEach((node) => node.parentElement?.removeChild(node));
    } catch {}
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
    teardownMsg91Widget();
  };

  const launchMsg91Widget = () => {
    if (typeof window === "undefined") return;
    if (!isMsg91Ready || typeof window.initSendOTP !== "function") {
      void ensureMsg91Provider();
      setStatusMessage("Verification is still loading. Please wait a moment.");
      return;
    }

    const attemptId = createAuthAttemptId();
    const method: AuthAttemptMethod = "mobile_otp";
    attemptRef.current = { id: attemptId, method, identifier: null };
    setLoading(true);
    setStatusMessage(null);

    logAuthEvent("AUTH_START", {
      attemptId,
      method,
      identifier: null,
      result: "started",
    });

    updateStatus("sending_otp", { result: "started" });
    logAuthEvent("OTP_REQUEST_STARTED", {
      attemptId,
      method,
      identifier: null,
      result: "started",
    });

    let verificationTimer: number | ReturnType<typeof setTimeout> | null = null;

    try {
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: false,
        identifier: "",
        "country-code": "91",
        "auto-country": false,
        captchaRenderId: "",
        success: async (payload: any) => {
          // ── HARD GUARD #1: Stale attempt → ignore. ──
          if (attemptRef.current?.id !== attemptId) return;
          // ── HARD GUARD #2: Cancel ALL armed timers IMMEDIATELY. No path can show "timed out" + "verified". ──
          controllerRef.current.clearAllTimers();

          const accessToken = extractMsg91AccessToken(payload);
          const verifiedPhone = extractMsg91Phone(payload);
          console.info("[auth] MSG91 success payload raw", sanitizeAuthDebugPayload(payload));
          console.info("[auth] MSG91 success payload parsed", {
            accessToken: maskSecret(accessToken),
            verifiedPhone,
          });
          if (!accessToken) {
            await finalizeFailure("Verification did not return a valid token. Please retry or use Email login.", "failed", false);
            return;
          }
          const normalizedIdentifier = verifiedPhone ? normalizeIdentifier(String(verifiedPhone)).normalized : null;
          attemptRef.current = { id: attemptId, method, identifier: normalizedIdentifier };

          // ── Re-arm a single 20s "session minting" guard, scoped to this attempt only. ──
          verificationTimer = controllerRef.current.registerTimer(window.setTimeout(async () => {
            if (attemptRef.current?.id !== attemptId) return;
            // If we reach here, status will already be "authenticated" or "failed"; only fire on a stuck mint.
            if (["authenticated", "failed", "fallback_to_email"].includes(controllerRef.current.getStatus())) return;
            logAuthEvent("AUTH_TIMEOUT_TRIGGERED", {
              attemptId, method, identifier: normalizedIdentifier, result: "failed", error: "session_mint_timeout",
            });
            await finalizeFailure("Session creation took too long. Please retry or use Email login.", "fallback_to_email", true);
            setActiveTab("email");
          }, 20000));

          updateStatus("verifying_otp", { result: "started" });
          logAuthEvent("OTP_REQUEST_SUCCESS", {
            attemptId, method, identifier: normalizedIdentifier, result: "success",
          });
          logAuthEvent("OTP_VERIFY_STARTED", {
            attemptId, method, identifier: normalizedIdentifier, result: "started",
          });
          console.log("OTP_VERIFIED - Starting Session Minting...");

          try {
            const { data: verifyRes, error } = await supabase.functions.invoke("msg91-otp", {
              body: { mode: "verify_widget", accessToken, phone: verifiedPhone },
            });

            console.info("[auth] verify_widget frontend request", sanitizeAuthDebugPayload({
              mode: "verify_widget",
              accessToken,
              phone: verifiedPhone,
            }));
            console.info("[auth] verify_widget frontend response", sanitizeAuthDebugPayload({
              error: error?.message ?? null,
              data: verifyRes ?? null,
            }));

            if (error) {
              throw new Error(`edge_verify_failed:${error.message}`);
            }

            if (!verifyRes?.ok) {
              throw new Error(`edge_verify_failed:${verifyRes?.error || verifyRes?.reason || "verification_rejected"}`);
            }

            const resolvedIdentifier = firstNonEmptyString(verifyRes?.phone, verifiedPhone);
            if (!resolvedIdentifier) {
              throw new Error("edge_verify_failed:phone_missing_from_widget_and_edge");
            }

            if (!verifyRes?.token_hash || !verifyRes?.user_id) {
              throw new Error(`edge_verify_failed:${!verifyRes?.token_hash ? "token_hash_missing" : "user_id_missing"}`);
            }

            const normalizedResolvedIdentifier = normalizeIdentifier(String(resolvedIdentifier)).normalized;
            attemptRef.current = { id: attemptId, method, identifier: normalizedResolvedIdentifier };

            logAuthEvent("OTP_VERIFY_SUCCESS", {
              attemptId,
              method,
              identifier: normalizedResolvedIdentifier,
              result: "success",
              details: { userId: verifyRes.user_id },
            });

            updateStatus("verification_success", { result: "success" });
            updateStatus("session_creation_in_progress", { result: "started" });
            logAuthEvent("SESSION_CREATE_STARTED", {
              attemptId,
              method,
              identifier: normalizedResolvedIdentifier,
              result: "started",
              details: { userId: verifyRes.user_id },
            });

            const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
              token_hash: verifyRes.token_hash,
              type: "magiclink",
            });

            if (sessionError || !sessionData.user) {
              throw new Error(`supabase_verifyOtp_failed:${sessionError?.message || "session_create_failed"}`);
            }

            logAuthEvent("SESSION_CREATE_SUCCESS", {
              attemptId,
              method,
              identifier: normalizedResolvedIdentifier,
              result: "success",
              details: { userId: sessionData.user.id },
            });
            console.log("SESSION_CREATED - Redirecting to Dashboard...");

            await redirectAfterAuth(normalizedResolvedIdentifier, method, sessionData.user.id, attemptId);
            controllerRef.current.finalize();
            setLoading(false);
          } catch (error) {
            console.error("[auth] Session minting failed:", error);
            await finalizeFailure("Session creation failed. Please try Email login.", "fallback_to_email", true);
            setActiveTab("email");
          }
        },
        failure: async (error: any) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(verificationTimer);
          const message = error?.message || error?.errorMessage || error?.type || "otp_verify_failed";
          logAuthEvent("OTP_REQUEST_FAILED", {
            attemptId,
            method,
            identifier: attemptRef.current?.identifier ?? null,
            result: "failed",
            error: message,
          });
          await finalizeFailure(mapOtpErrorMessage(message), /timeout/i.test(message) ? "fallback_to_email" : "failed");
        },
      });

      updateStatus("otp_sent", { result: "success" });
    } catch (error) {
      controllerRef.current.clearTimer(verificationTimer);
      const message = error instanceof Error ? error.message : "otp_request_failed";
      logAuthEvent("OTP_REQUEST_FAILED", {
        attemptId,
        method,
        identifier: null,
        result: "failed",
        error: message,
      });
      void finalizeFailure(mapOtpErrorMessage(message), "fallback_to_email");
      setActiveTab("email");
    }
  };

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
      await finalizeFailure(message.includes("Invalid") ? "Invalid email or password." : getAuthUserMessage(error), "failed");
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
      await redirectAfterAuth(trimmedEmail, method, data.user.id, attemptId);
      setLoading(false);
    } catch (error) {
      await finalizeFailure(getAuthUserMessage(error), "failed", true);
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: "https://b2b.oasisbaklawa.com/reset-password",
    });

    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  };

  const tabClass = (tab: AuthTab) =>
    `flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
      activeTab === tab
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

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
          <h1 className="text-3xl text-foreground">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your B2B account</p>
        </div>

        <div className="bg-card rounded-2xl p-6 space-y-5 border border-border shadow-sm">
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            <button onClick={() => setActiveTab("msg91")} className={tabClass("msg91")}>
              <ShieldCheck size={12} className="inline mr-1 -mt-0.5" />Mobile Verification
            </button>
            <button onClick={() => setActiveTab("email")} className={tabClass("email")}>
              <Mail size={12} className="inline mr-1 -mt-0.5" />Email
            </button>
          </div>

          {activeTab === "msg91" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                <ShieldCheck size={28} className="mx-auto text-primary" />
                <p className="text-sm font-bold text-foreground">Secure Mobile Verification</p>
                <p className="text-xs text-muted-foreground">Verification via SMS, WhatsApp, or Voice.</p>
              </div>
              <button
                onClick={launchMsg91Widget}
                disabled={loading || !isMsg91Ready}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:brightness-110 disabled:opacity-60"
              >
                {(loading || !isMsg91Ready) ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {!isMsg91Ready ? "Preparing verification…" : loading ? "Opening verification…" : "Continue with mobile verification"}
              </button>
            </div>
          )}

          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@business.com"
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
          )}

          {statusMessage && !isMinting && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${authStatus === "failed" || authStatus === "fallback_to_email" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>
              {statusMessage}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground font-medium">or continue with</span></div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled
              title="Additional sign-in options will be available in a future release."
              className="flex-1 py-3 rounded-xl border border-border bg-muted/50 text-muted-foreground font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <svg className="w-4 h-4 shrink-0 opacity-60" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google — Coming soon
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            New to Oasis Baklawa?{" "}
            <button onClick={() => navigate("/register")} className="text-primary font-semibold hover:underline">
              Apply for B2B Access
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
