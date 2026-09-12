import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, MessageCircle, Phone, PhoneCall, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import { createAuthStateController, getCustomerAuthUserMessage, readAuthCache, redirectAfterAuth, type AuthStatus } from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { isEmailIdentifier, normalizeIdentifier, normalizePhone } from "@/lib/auth-identity";
import { signOutAndClearSession } from "@/utils/authSession";

// MSG91 "Widget ID" and "Auth Token" are the pair MSG91's own OTP Widget SDK
// requires in the browser to boot its verification UI. They are not the MSG91
// account authkey used to call MSG91 REST send APIs; that server-side provider
// secret lives only in the msg91-otp Edge Function environment.
const MSG91_WIDGET_ID = "3664766e464b383030383331";
const MSG91_TOKEN_AUTH = "509994T6SRbi4LqM69ea72d0P1";
const MSG91_PROVIDER_SCRIPT_ID = "msg91-otp-provider";

const SUPPORT_EMAIL = "support@oasisbaklawa.com";
const SUPPORT_WHATSAPP = (import.meta.env.VITE_B2B_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const SUPPORT_PHONE = import.meta.env.VITE_B2B_SUPPORT_PHONE || "";

type BuyerLoginChannel = "mobile" | "email" | null;

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
  if (message.includes("provider_not_linked") || message.includes("phone_not_linked")) return "This mobile number is not linked to an approved B2B account.";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const BuyerLogin = () => {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<BuyerLoginChannel>(null);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMsg91Ready, setIsMsg91Ready] = useState(false);
  const controllerRef = useRef(createAuthStateController("idle"));
  const attemptRef = useRef<{ id: string; method: AuthAttemptMethod; identifier: string | null } | null>(null);
  const providerLoadRef = useRef<Promise<void> | null>(null);

  const isMinting = useMemo(() => {
    const minting = ["verifying_otp", "verification_success", "session_creation_in_progress", "account_resolution_in_progress", "profile_loading", "role_loading"].includes(authStatus);
    if (!minting) return false;
    const cached = typeof window !== "undefined" ? readAuthCache() : null;
    return !(cached && cached.role);
  }, [authStatus]);

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

  const teardownMsg91Widget = () => {
    if (typeof document === "undefined") return;
    try {
      document
        .querySelectorAll("[id^='msg91'], [class*='msg91'], iframe[src*='msg91']")
        .forEach((node) => node.parentElement?.removeChild(node));
    } catch {
      // Best-effort cleanup only.
    }
  };

  const finalizeFailure = async (message: string, finalState: AuthStatus = "failed", shouldSignOut = false) => {
    controllerRef.current.clearAllTimers();
    controllerRef.current.finalize();
    if (shouldSignOut) await signOutAndClearSession();
    updateStatus(finalState, { result: "failed", error: message });
    setStatusMessage(message);
    setLoading(false);
    teardownMsg91Widget();
  };

  const runRedirectAfterAuth = async (identity: string, method: AuthAttemptMethod, userId?: string, attemptId?: string) => {
    await redirectAfterAuth({
      identity,
      method,
      userId,
      attemptId,
      navigate,
      setStatus: (next, meta) => updateStatus(next, meta),
      requiredMembership: "buyer",
    });
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

  // Backward compatibility for an already-issued Supabase magic link. New
  // buyer logins use OTP only, but an older unexpired link must still fail
  // closed through the same buyer membership boundary.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("manual_auth") !== "true") return;

    const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash || "");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    (async () => {
      setLoading(true);
      setStatusMessage("Authenticating secure link…");
      try {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) {
          toast.error("This sign-in link is no longer valid. Please request a new OTP.");
          setLoading(false);
          return;
        }
        window.history.replaceState({}, "", url.pathname);
        const identity = data.session.user.email || data.session.user.phone || data.session.user.id;
        await runRedirectAfterAuth(identity, "session_restore", data.session.user.id);
      } catch (err) {
        await signOutAndClearSession();
        toast.error(getCustomerAuthUserMessage(err));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void ensureMsg91Provider().catch(() => {
      setIsMsg91Ready(false);
    });
    updateStatus("entering_identifier", { result: "info" });
    return () => controllerRef.current.finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureMsg91Provider]);

  const handleApplyForB2BAccess = () => {
    navigate("/buyer/access-request");
  };

  const launchMsg91Widget = async () => {
    if (typeof window === "undefined") return;

    const phone = normalizePhone(mobile);
    if (!phone.last10 || phone.last10.length !== 10) {
      setStatusMessage("Enter a valid registered mobile number.");
      setAuthStatus("failed");
      return;
    }

    try {
      await ensureMsg91Provider();
    } catch {
      setStatusMessage("Mobile verification is unavailable right now. Please use Email OTP or try again shortly.");
      setAuthStatus("failed");
      return;
    }

    if (!isMsg91Ready && typeof window.initSendOTP !== "function") {
      setStatusMessage("Mobile verification is still loading. Please try again in a moment.");
      return;
    }
    if (typeof window.initSendOTP !== "function") return;

    const attemptId = createAuthAttemptId();
    const method: AuthAttemptMethod = "mobile_otp";
    const identifier = phone.e164 || mobile.trim();
    attemptRef.current = { id: attemptId, method, identifier };
    setLoading(true);
    setStatusMessage(null);

    logAuthEvent("AUTH_START", { attemptId, method, identifier, result: "started" });
    updateStatus("sending_otp", { result: "started" });
    logAuthEvent("OTP_REQUEST_STARTED", { attemptId, method, identifier, result: "started" });

    let verificationTimer: number | ReturnType<typeof setTimeout> | null = null;

    try {
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: false,
        identifier,
        "country-code": "91",
        "auto-country": false,
        captchaRenderId: "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        success: async (payload: any) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearAllTimers();

          const accessToken = extractMsg91AccessToken(payload);
          const verifiedPhone = extractMsg91Phone(payload);
          console.info("[auth] MSG91 success payload raw", sanitizeAuthDebugPayload(payload));
          console.info("[auth] MSG91 success payload parsed", {
            accessToken: maskSecret(accessToken),
            verifiedPhone,
          });
          if (!accessToken) {
            await finalizeFailure("Verification did not return a valid token. Please retry.", "failed", false);
            return;
          }

          const normalizedIdentifier = verifiedPhone
            ? normalizeIdentifier(String(verifiedPhone)).normalized
            : identifier;
          attemptRef.current = { id: attemptId, method, identifier: normalizedIdentifier };

          verificationTimer = controllerRef.current.registerTimer(window.setTimeout(async () => {
            if (attemptRef.current?.id !== attemptId) return;
            if (["authenticated", "failed", "fallback_to_email"].includes(controllerRef.current.getStatus())) return;
            logAuthEvent("AUTH_TIMEOUT_TRIGGERED", {
              attemptId,
              method,
              identifier: normalizedIdentifier,
              result: "failed",
              error: "session_mint_timeout",
            });
            await finalizeFailure("Session creation took too long. Please retry.", "failed", true);
          }, 20000));

          updateStatus("verifying_otp", { result: "started" });
          logAuthEvent("OTP_REQUEST_SUCCESS", { attemptId, method, identifier: normalizedIdentifier, result: "success" });
          logAuthEvent("OTP_VERIFY_STARTED", { attemptId, method, identifier: normalizedIdentifier, result: "started" });

          try {
            const { data: verifyRes, error } = await supabase.functions.invoke("msg91-otp", {
              body: { mode: "verify_widget", accessToken, phone: verifiedPhone || identifier },
            });

            console.info("[auth] verify_widget frontend response", sanitizeAuthDebugPayload({
              error: error?.message ?? null,
              data: verifyRes ?? null,
            }));

            if (error) throw new Error(`edge_verify_failed:${error.message}`);
            if (!verifyRes?.ok) {
              throw new Error(`edge_verify_failed:${verifyRes?.error || verifyRes?.reason || "verification_rejected"}`);
            }

            const resolvedIdentifier = firstNonEmptyString(verifyRes?.phone, verifiedPhone, identifier);
            if (!resolvedIdentifier) throw new Error("edge_verify_failed:phone_missing_from_widget_and_edge");
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

            await runRedirectAfterAuth(normalizedResolvedIdentifier, method, sessionData.user.id, attemptId);
            controllerRef.current.finalize();
            setLoading(false);
          } catch (error) {
            console.error("[auth] Session minting failed:", error);
            await finalizeFailure(getCustomerAuthUserMessage(error), "failed", true);
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failure: async (error: any) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(verificationTimer);
          const message = error?.message || error?.errorMessage || error?.type || "otp_verify_failed";
          logAuthEvent("OTP_REQUEST_FAILED", {
            attemptId,
            method,
            identifier,
            result: "failed",
            error: message,
          });
          await finalizeFailure(mapOtpErrorMessage(message), "failed");
        },
      });

      updateStatus("otp_sent", { result: "success" });
    } catch (error) {
      controllerRef.current.clearTimer(verificationTimer);
      const message = error instanceof Error ? error.message : "otp_request_failed";
      logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: message });
      void finalizeFailure(mapOtpErrorMessage(message), "failed");
    }
  };

  const sendEmailOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isEmailIdentifier(trimmedEmail)) {
      setAuthStatus("failed");
      setStatusMessage("Enter a valid registered email address.");
      return;
    }

    const attemptId = createAuthAttemptId();
    const method: AuthAttemptMethod = "email_otp";
    const identifier = normalizeIdentifier(trimmedEmail).normalized;
    attemptRef.current = { id: attemptId, method, identifier };
    setLoading(true);
    setStatusMessage(null);
    updateStatus("sending_otp", { result: "started" });
    logAuthEvent("AUTH_START", { attemptId, method, identifier, result: "started" });
    logAuthEvent("OTP_REQUEST_STARTED", { attemptId, method, identifier, result: "started" });

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false },
    });

    if (error) {
      logAuthEvent("OTP_REQUEST_FAILED", {
        attemptId,
        method,
        identifier,
        result: "failed",
        error: error.message,
      });
      await finalizeFailure("We couldn't send an email OTP. Please check the address or use Mobile OTP.");
      return;
    }

    logAuthEvent("OTP_REQUEST_SUCCESS", { attemptId, method, identifier, result: "success" });
    updateStatus("otp_sent", { result: "success" });
    setEmailOtpSent(true);
    setStatusMessage("A 6-digit OTP has been sent to your registered email address.");
    setLoading(false);
  };

  const verifyEmailOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const token = emailOtp.replace(/\D/g, "");
    if (!isEmailIdentifier(trimmedEmail) || token.length !== 6) {
      setAuthStatus("failed");
      setStatusMessage("Enter the 6-digit OTP sent to your email.");
      return;
    }

    const attemptId = attemptRef.current?.id || createAuthAttemptId();
    const method: AuthAttemptMethod = "email_otp";
    const identifier = normalizeIdentifier(trimmedEmail).normalized;
    attemptRef.current = { id: attemptId, method, identifier };
    setLoading(true);
    setStatusMessage(null);
    updateStatus("verifying_otp", { result: "started" });
    logAuthEvent("OTP_VERIFY_STARTED", { attemptId, method, identifier, result: "started" });

    const { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token,
      type: "email",
    });

    if (error || !data.user) {
      logAuthEvent("OTP_VERIFY_FAILED", {
        attemptId,
        method,
        identifier,
        result: "failed",
        error: error?.message || "email_otp_verify_failed",
      });
      await finalizeFailure("The email OTP is invalid or expired. Please request a new code.", "failed", true);
      return;
    }

    logAuthEvent("OTP_VERIFY_SUCCESS", {
      attemptId,
      method,
      identifier,
      result: "success",
      details: { userId: data.user.id },
    });
    updateStatus("verification_success", { result: "success" });
    logAuthEvent("SESSION_CREATE_SUCCESS", {
      attemptId,
      method,
      identifier,
      result: "success",
      details: { userId: data.user.id },
    });

    try {
      await runRedirectAfterAuth(identifier, method, data.user.id, attemptId);
      controllerRef.current.finalize();
      setLoading(false);
    } catch (authError) {
      await finalizeFailure(getCustomerAuthUserMessage(authError), "failed", true);
    }
  };

  const goBackToChannelChoice = () => {
    setChannel(null);
    setEmailOtpSent(false);
    setEmailOtp("");
    setStatusMessage(null);
    setAuthStatus("entering_identifier");
    setLoading(false);
  };

  const openSupport = (kind: "whatsapp" | "call") => {
    if (kind === "whatsapp" && SUPPORT_WHATSAPP) {
      window.open(`https://wa.me/${SUPPORT_WHATSAPP}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (kind === "call" && SUPPORT_PHONE) {
      window.location.href = `tel:${SUPPORT_PHONE}`;
      return;
    }
    toast.info(`Support contact is not configured on this preview. Email ${SUPPORT_EMAIL}.`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background">
      {isMinting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <Loader2 size={42} className="animate-spin text-primary" />
          <p className="mt-5 text-base font-medium text-primary">Securing your Oasis session...</p>
        </div>
      )}

      <div className="w-full max-w-sm space-y-7 py-8">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" width={134} height={96} fetchPriority="high" decoding="async" className="h-12 w-auto mx-auto object-contain" />
          <h1 className="text-3xl text-foreground">Log in to your account</h1>
          <p className="text-sm text-muted-foreground">Use your registered mobile number or registered email. No password is required.</p>
        </div>

        {channel === null && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { setChannel("mobile"); setStatusMessage(null); }}
              className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Phone size={21} /></span>
                <span>
                  <span className="block text-sm font-bold text-foreground">Mobile OTP</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Verify your registered mobile through MSG91.</span>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setChannel("email"); setStatusMessage(null); }}
              className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail size={21} /></span>
                <span>
                  <span className="block text-sm font-bold text-foreground">Email OTP</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Receive a 6-digit code on your registered email.</span>
                </span>
              </span>
            </button>
          </div>
        )}

        {channel === "mobile" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <button type="button" onClick={goBackToChannelChoice} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft size={15} /> Change login method
            </button>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <ShieldCheck size={28} className="mx-auto text-primary" />
              <p className="text-sm font-bold text-foreground">Secure Mobile Verification</p>
              <p className="text-xs text-muted-foreground">OTP may be delivered by SMS, WhatsApp or voice according to MSG91 policy.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="buyer-mobile" className="text-xs font-semibold text-foreground">Registered mobile number</label>
              <Input
                id="buyer-mobile"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                className="rounded-xl"
              />
            </div>
            <button
              type="button"
              onClick={() => void launchMsg91Widget()}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {loading ? "Opening verification…" : "Send mobile OTP"}
            </button>
          </div>
        )}

        {channel === "email" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <button type="button" onClick={goBackToChannelChoice} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft size={15} /> Change login method
            </button>
            <div className="space-y-2">
              <label htmlFor="buyer-email" className="text-xs font-semibold text-foreground">Registered email address</label>
              <Input
                id="buyer-email"
                type="email"
                autoComplete="email"
                placeholder="buyer@company.com"
                value={email}
                disabled={emailOtpSent}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl"
              />
            </div>

            {!emailOtpSent ? (
              <button
                type="button"
                onClick={() => void sendEmailOtp()}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {loading ? "Sending OTP…" : "Send email OTP"}
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="buyer-email-otp" className="text-xs font-semibold text-foreground">6-digit email OTP</label>
                  <Input
                    id="buyer-email-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={emailOtp}
                    onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(event) => event.key === "Enter" && void verifyEmailOtp()}
                    className="rounded-xl text-center tracking-[0.35em]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void verifyEmailOtp()}
                  disabled={loading || emailOtp.length !== 6}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {loading ? "Verifying…" : "Verify and continue"}
                </button>
                <button
                  type="button"
                  onClick={() => void sendEmailOtp()}
                  disabled={loading}
                  className="w-full text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                >
                  Resend email OTP
                </button>
              </>
            )}
          </div>
        )}

        {statusMessage && !isMinting && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${authStatus === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>
            {statusMessage}
          </div>
        )}

        <div className="space-y-4 border-t border-border pt-5 text-center">
          <p className="text-sm text-muted-foreground">
            New distributor?{" "}
            <button onClick={handleApplyForB2BAccess} className="text-primary font-semibold hover:underline">
              Request B2B Access
            </button>
          </p>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Need assistance?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => openSupport("whatsapp")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-semibold">
                <MessageCircle size={16} /> WhatsApp Oasis
              </button>
              <button type="button" onClick={() => openSupport("call")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-semibold">
                <PhoneCall size={16} /> Call Oasis
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/staff/login")}
            className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Admin Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuyerLogin;
