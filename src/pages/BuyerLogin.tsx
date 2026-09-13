import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, MessageCircle, Phone, PhoneCall, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import {
  createAuthStateController,
  getCustomerAuthUserMessage,
  readAuthCache,
  redirectAfterAuth,
  type AuthStatus,
} from "@/lib/auth-flow";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { isEmailIdentifier, normalizeIdentifier, normalizePhone } from "@/lib/auth-identity";
import { signOutAndClearSession } from "@/utils/authSession";

// MSG91 "Widget ID" and "Auth Token" are the browser OTP-widget configuration
// required by MSG91's Web SDK. They are not the MSG91 account provider secret;
// the provider credential used for server verification remains Edge-only.
const MSG91_WIDGET_ID = "3664766e464b383030383331";
const MSG91_TOKEN_AUTH = "509994T6SRbi4LqM69ea72d0P1";
const MSG91_PROVIDER_SCRIPT_ID = "msg91-otp-provider";
const MSG91_CAPTCHA_ID = "msg91-captcha";
const MSG91_PROVIDER_CALL_TIMEOUT_MS = 20_000;
const MSG91_EDGE_TIMEOUT_MS = 15_000;

const SUPPORT_EMAIL = "support@oasisbaklawa.com";
const SUPPORT_WHATSAPP = (import.meta.env.VITE_B2B_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const SUPPORT_PHONE = import.meta.env.VITE_B2B_SUPPORT_PHONE || "";

type BuyerLoginChannel = "mobile" | "email" | null;
type Msg91Callback = (payload: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (cfg: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
    verifyOtp?: (otp: number | string, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
    retryOtp?: (channel: string | null, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
  }
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
function extractMsg91RequestId(payload: any) {
  return firstNonEmptyString(
    payload?.reqId,
    payload?.req_id,
    payload?.requestId,
    payload?.request_id,
    payload?.message?.reqId,
    payload?.message?.requestId,
    payload?.data?.reqId,
    payload?.data?.requestId,
  );
}

function providerErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return firstNonEmptyString(record.message, record.errorMessage, record.error, record.type) ?? "otp_request_failed";
  }
  return typeof error === "string" ? error : "otp_request_failed";
}

function mapOtpErrorMessage(rawMessage?: string | null) {
  const message = (rawMessage ?? "").toLowerCase();
  if (message.includes("session_token_mint_failed") || message.includes("session_token_missing")) return "MSG91 verified the OTP, but session creation failed. Please retry.";
  if (message.includes("session_token_mint_timeout") || message.includes("msg91_edge_timeout")) return "MSG91 verified the OTP, but Oasis session creation timed out. Please retry.";
  if (message.includes("expired")) return "OTP expired. Please request a new code.";
  if (message.includes("invalid") || message.includes("incorrect")) return "OTP invalid. Please enter the correct code and try again.";
  if (message.includes("network") || message.includes("fetch")) return "Network error. Please check your connection and try again.";
  if (message.includes("phone_linked_to_missing_auth_identity")) return "This mobile identity needs account reconciliation. Please contact Oasis support.";
  if (message.includes("duplicate_phone_identity")) return "This mobile number is linked to more than one account. Please contact Oasis support.";
  if (message.includes("provider_verification_failed")) return "MSG91 could not verify this OTP session. Please request a new OTP.";
  return "Mobile verification failed. Please try again.";
}

const BuyerLogin = () => {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<BuyerLoginChannel>(null);
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileReqId, setMobileReqId] = useState<string | null>(null);
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
  const providerInitializedRef = useRef(false);

  const isMinting = useMemo(() => {
    const minting = [
      "verifying_otp",
      "verification_success",
      "session_creation_in_progress",
      "account_resolution_in_progress",
      "profile_loading",
      "role_loading",
    ].includes(authStatus);
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

  const finalizeFailure = async (message: string, shouldSignOut = false) => {
    controllerRef.current.clearAllTimers();
    if (shouldSignOut) await signOutAndClearSession();
    updateStatus("failed", { result: "failed", error: message });
    setStatusMessage(message);
    setLoading(false);
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

  const loadMsg91Script = useCallback(() => {
    if (typeof window === "undefined") return Promise.resolve();
    if (typeof window.initSendOTP === "function") return Promise.resolve();
    if (providerLoadRef.current) return providerLoadRef.current;

    providerLoadRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(MSG91_PROVIDER_SCRIPT_ID) as HTMLScriptElement | null;
      const awaitSdk = () => {
        let attempts = 0;
        const poll = window.setInterval(() => {
          attempts += 1;
          if (typeof window.initSendOTP === "function") {
            window.clearInterval(poll);
            resolve();
          } else if (attempts >= 160) {
            window.clearInterval(poll);
            providerLoadRef.current = null;
            reject(new Error("msg91_provider_load_timeout"));
          }
        }, 125);
      };

      if (existing) {
        awaitSdk();
        existing.addEventListener("error", () => {
          providerLoadRef.current = null;
          reject(new Error("msg91_provider_load_failed"));
        }, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = MSG91_PROVIDER_SCRIPT_ID;
      script.src = "https://verify.msg91.com/otp-provider.js";
      script.async = true;
      script.onload = awaitSdk;
      script.onerror = () => {
        providerLoadRef.current = null;
        reject(new Error("msg91_provider_load_failed"));
      };
      document.body.appendChild(script);
    });

    return providerLoadRef.current;
  }, []);

  const ensureMsg91CustomUi = useCallback(async () => {
    await loadMsg91Script();
    if (typeof window === "undefined" || typeof window.initSendOTP !== "function") {
      throw new Error("msg91_provider_unavailable");
    }

    if (!providerInitializedRef.current) {
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: true,
        identifier: "",
        "country-code": "91",
        "auto-country": false,
        captchaRenderId: MSG91_CAPTCHA_ID,
      });
      providerInitializedRef.current = true;
    }

    if (typeof window.sendOtp === "function" && typeof window.verifyOtp === "function") {
      setIsMsg91Ready(true);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts += 1;
        if (typeof window.sendOtp === "function" && typeof window.verifyOtp === "function") {
          window.clearInterval(poll);
          setIsMsg91Ready(true);
          resolve();
        } else if (attempts >= 160) {
          window.clearInterval(poll);
          providerInitializedRef.current = false;
          reject(new Error("msg91_custom_methods_unavailable"));
        }
      }, 125);
    });
  }, [loadMsg91Script]);

  useEffect(() => {
    void loadMsg91Script().catch(() => setIsMsg91Ready(false));
    updateStatus("entering_identifier", { result: "info" });
    return () => controllerRef.current.finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMsg91Script]);

  const verifiedMobileSession = async (payload: unknown, identifier: string, attemptId: string) => {
    const method: AuthAttemptMethod = "mobile_otp";
    const accessToken = extractMsg91AccessToken(payload);
    if (!accessToken) {
      await finalizeFailure("MSG91 verified the OTP but did not return a verification token. Please request a new OTP.");
      return;
    }

    updateStatus("verifying_otp", { result: "started" });
    const abortController = controllerRef.current.createAbortController();
    const edgeTimeout = controllerRef.current.registerTimer(window.setTimeout(() => abortController.abort(), MSG91_EDGE_TIMEOUT_MS));
    try {
      const { data: verifyRes, error } = await supabase.functions.invoke("msg91-otp", {
        body: { mode: "verify_widget", accessToken, phone: identifier, attemptId },
        signal: abortController.signal,
      });
      controllerRef.current.clearTimer(edgeTimeout);
      if (error) throw new Error(error.message);
      if (!verifyRes?.ok) throw new Error(verifyRes?.error || verifyRes?.reason || "provider_verification_failed");
      if (!verifyRes?.token_hash || !verifyRes?.user_id) throw new Error("session_token_missing");

      const resolvedIdentifier = firstNonEmptyString(verifyRes?.phone, identifier) ?? identifier;
      const normalizedIdentifier = normalizeIdentifier(resolvedIdentifier).normalized;
      attemptRef.current = { id: attemptId, method, identifier: normalizedIdentifier };
      logAuthEvent("OTP_VERIFY_SUCCESS", {
        attemptId,
        method,
        identifier: normalizedIdentifier,
        result: "success",
        details: { userId: verifyRes.user_id },
      });

      updateStatus("verification_success", { result: "success" });
      updateStatus("session_creation_in_progress", { result: "started" });
      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyRes.token_hash,
        type: "magiclink",
      });
      if (sessionError || !sessionData.user) throw new Error(sessionError?.message || "session_create_failed");

      logAuthEvent("SESSION_CREATE_SUCCESS", {
        attemptId,
        method,
        identifier: normalizedIdentifier,
        result: "success",
        details: { userId: sessionData.user.id },
      });

      await runRedirectAfterAuth(normalizedIdentifier, method, sessionData.user.id, attemptId);
      controllerRef.current.finalize();
      setLoading(false);
    } catch (error) {
      controllerRef.current.clearTimer(edgeTimeout);
      const raw = abortController.signal.aborted ? "session_token_mint_timeout" : error instanceof Error ? error.message : "mobile_session_failed";
      logAuthEvent("OTP_VERIFY_FAILED", {
        attemptId,
        method,
        identifier,
        result: "failed",
        error: raw,
      });
      await finalizeFailure(mapOtpErrorMessage(raw), true);
    }
  };

  const sendMobileOtp = async () => {
    const phone = normalizePhone(mobile);
    if (!phone.last10 || phone.last10.length !== 10) {
      setAuthStatus("failed");
      setStatusMessage("Enter a valid registered mobile number.");
      return;
    }

    const identifier = `91${phone.last10}`;
    const attemptId = createAuthAttemptId();
    const method: AuthAttemptMethod = "mobile_otp";
    attemptRef.current = { id: attemptId, method, identifier: phone.e164 || identifier };
    setLoading(true);
    setStatusMessage(null);
    updateStatus("sending_otp", { result: "started" });
    logAuthEvent("AUTH_START", { attemptId, method, identifier: phone.e164 || identifier, result: "started" });
    logAuthEvent("OTP_REQUEST_STARTED", { attemptId, method, identifier: phone.e164 || identifier, result: "started" });

    try {
      await ensureMsg91CustomUi();
      if (typeof window.sendOtp !== "function") throw new Error("msg91_send_method_unavailable");
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier: phone.e164 || identifier, result: "failed", error: "msg91_send_timeout" });
        void finalizeFailure("OTP request timed out. Please retry.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));

      window.sendOtp(
        identifier,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const reqId = extractMsg91RequestId(payload);
          setMobileReqId(reqId);
          setMobileOtpSent(true);
          setMobileOtp("");
          setLoading(false);
          updateStatus("otp_sent", { result: "success", details: { requestIdPresent: Boolean(reqId) } });
          logAuthEvent("OTP_REQUEST_SUCCESS", {
            attemptId,
            method,
            identifier: phone.e164 || identifier,
            result: "success",
            details: { requestIdPresent: Boolean(reqId) },
          });
          setStatusMessage("OTP sent to your registered mobile number.");
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const message = providerErrorMessage(error);
          logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier: phone.e164 || identifier, result: "failed", error: message });
          void finalizeFailure(mapOtpErrorMessage(message));
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "otp_request_failed";
      logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier: phone.e164 || identifier, result: "failed", error: message });
      await finalizeFailure("Mobile verification could not start. Please try again shortly.");
    }
  };

  const verifyMobileOtp = async () => {
    const otp = mobileOtp.replace(/\D/g, "");
    const phone = normalizePhone(mobile);
    if (!mobileOtpSent || !phone.last10 || otp.length < 4 || otp.length > 8) {
      setAuthStatus("failed");
      setStatusMessage("Enter the OTP sent to your registered mobile number.");
      return;
    }

    const identifier = `91${phone.last10}`;
    const attemptId = attemptRef.current?.id || createAuthAttemptId();
    const method: AuthAttemptMethod = "mobile_otp";
    attemptRef.current = { id: attemptId, method, identifier: phone.e164 || identifier };
    setLoading(true);
    setStatusMessage(null);
    updateStatus("verifying_otp", { result: "started" });
    logAuthEvent("OTP_VERIFY_STARTED", { attemptId, method, identifier: phone.e164 || identifier, result: "started" });

    try {
      await ensureMsg91CustomUi();
      if (typeof window.verifyOtp !== "function") throw new Error("msg91_verify_method_unavailable");
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier: phone.e164 || identifier, result: "failed", error: "msg91_verify_timeout" });
        void finalizeFailure("OTP verification timed out. Please retry.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));
      window.verifyOtp(
        otp,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          void verifiedMobileSession(payload, identifier, attemptId);
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const message = providerErrorMessage(error);
          logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier: phone.e164 || identifier, result: "failed", error: message });
          void finalizeFailure(mapOtpErrorMessage(message));
        },
        mobileReqId ?? undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "otp_verify_failed";
      await finalizeFailure(mapOtpErrorMessage(message));
    }
  };

  const resendMobileOtp = async () => {
    if (!mobileOtpSent) return void sendMobileOtp();
    const attemptId = attemptRef.current?.id;
    if (!attemptId) return void sendMobileOtp();
    setLoading(true);
    setStatusMessage(null);
    try {
      await ensureMsg91CustomUi();
      if (typeof window.retryOtp !== "function") {
        setLoading(false);
        return void sendMobileOtp();
      }
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        void finalizeFailure("OTP resend timed out. Please retry.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));
      window.retryOtp(
        null,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const reqId = extractMsg91RequestId(payload) ?? mobileReqId;
          setMobileReqId(reqId);
          setMobileOtp("");
          setLoading(false);
          setStatusMessage("A fresh OTP has been requested.");
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const message = providerErrorMessage(error);
          void finalizeFailure(mapOtpErrorMessage(message));
        },
        mobileReqId ?? undefined,
      );
    } catch {
      setLoading(false);
      if (attemptRef.current?.id === attemptId) await sendMobileOtp();
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
      logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: error.message });
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

    const { data, error } = await supabase.auth.verifyOtp({ email: trimmedEmail, token, type: "email" });
    if (error || !data.user) {
      logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier, result: "failed", error: error?.message || "email_otp_verify_failed" });
      await finalizeFailure("The email OTP is invalid or expired. Please request a new code.", true);
      return;
    }

    logAuthEvent("OTP_VERIFY_SUCCESS", { attemptId, method, identifier, result: "success", details: { userId: data.user.id } });
    updateStatus("verification_success", { result: "success" });
    try {
      await runRedirectAfterAuth(identifier, method, data.user.id, attemptId);
      controllerRef.current.finalize();
      setLoading(false);
    } catch (authError) {
      await finalizeFailure(getCustomerAuthUserMessage(authError), true);
    }
  };

  const goBackToChannelChoice = () => {
    controllerRef.current.clearAllTimers();
    attemptRef.current = null;
    setChannel(null);
    setMobileOtpSent(false);
    setMobileOtp("");
    setMobileReqId(null);
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
    toast.info(`Support contact is unavailable right now. Email ${SUPPORT_EMAIL}.`);
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
            <button type="button" onClick={() => { setChannel("mobile"); setStatusMessage(null); }} className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Phone size={21} /></span>
                <span><span className="block text-sm font-bold text-foreground">Mobile OTP</span><span className="mt-1 block text-xs text-muted-foreground">Verify your registered mobile through MSG91.</span></span>
              </span>
            </button>
            <button type="button" onClick={() => { setChannel("email"); setStatusMessage(null); }} className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail size={21} /></span>
                <span><span className="block text-sm font-bold text-foreground">Email OTP</span><span className="mt-1 block text-xs text-muted-foreground">Receive a 6-digit code on your registered email.</span></span>
              </span>
            </button>
          </div>
        )}

        {channel === "mobile" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <button type="button" onClick={goBackToChannelChoice} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Change login method</button>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <ShieldCheck size={28} className="mx-auto text-primary" />
              <p className="text-sm font-bold text-foreground">Secure Mobile Verification</p>
              <p className="text-xs text-muted-foreground">OTP is sent and verified through MSG91 before Oasis creates the Buyer session.</p>
            </div>
            <div id={MSG91_CAPTCHA_ID} />
            <div className="space-y-2">
              <label htmlFor="buyer-mobile" className="text-xs font-semibold text-foreground">Registered mobile number</label>
              <Input id="buyer-mobile" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={mobile} disabled={mobileOtpSent} onChange={(event) => setMobile(event.target.value)} className="rounded-xl" />
            </div>

            {!mobileOtpSent ? (
              <button type="button" onClick={() => void sendMobileOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {loading ? "Sending OTP…" : isMsg91Ready ? "Send mobile OTP" : "Send mobile OTP"}
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="buyer-mobile-otp" className="text-xs font-semibold text-foreground">Mobile OTP</label>
                  <Input id="buyer-mobile-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="Enter OTP" value={mobileOtp} onChange={(event) => setMobileOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(event) => event.key === "Enter" && void verifyMobileOtp()} className="rounded-xl text-center tracking-[0.3em]" />
                </div>
                <button type="button" onClick={() => void verifyMobileOtp()} disabled={loading || mobileOtp.length < 4} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {loading ? "Verifying…" : "Verify and continue"}
                </button>
                <button type="button" onClick={() => void resendMobileOtp()} disabled={loading} className="w-full text-xs font-semibold text-primary hover:underline disabled:opacity-60">Resend mobile OTP</button>
              </>
            )}
          </div>
        )}

        {channel === "email" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <button type="button" onClick={goBackToChannelChoice} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Change login method</button>
            <div className="space-y-2">
              <label htmlFor="buyer-email" className="text-xs font-semibold text-foreground">Registered email address</label>
              <Input id="buyer-email" type="email" autoComplete="email" placeholder="buyer@company.com" value={email} disabled={emailOtpSent} onChange={(event) => setEmail(event.target.value)} className="rounded-xl" />
            </div>
            {!emailOtpSent ? (
              <button type="button" onClick={() => void sendEmailOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {loading ? "Sending OTP…" : "Send email OTP"}
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="buyer-email-otp" className="text-xs font-semibold text-foreground">6-digit email OTP</label>
                  <Input id="buyer-email-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => event.key === "Enter" && void verifyEmailOtp()} className="rounded-xl text-center tracking-[0.35em]" />
                </div>
                <button type="button" onClick={() => void verifyEmailOtp()} disabled={loading || emailOtp.length !== 6} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {loading ? "Verifying…" : "Verify and continue"}
                </button>
                <button type="button" onClick={() => void sendEmailOtp()} disabled={loading} className="w-full text-xs font-semibold text-primary hover:underline disabled:opacity-60">Resend email OTP</button>
              </>
            )}
          </div>
        )}

        {statusMessage && !isMinting && (
          <div role={authStatus === "failed" ? "alert" : "status"} aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${authStatus === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>{statusMessage}</div>
        )}

        <div className="space-y-4 border-t border-border pt-5 text-center">
          <p className="text-sm text-muted-foreground">New distributor?{" "}<button onClick={() => navigate("/buyer/access-request")} className="text-primary font-semibold hover:underline">Request B2B Access</button></p>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Need assistance?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => openSupport("whatsapp")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-semibold"><MessageCircle size={16} /> WhatsApp Oasis</button>
              <button type="button" onClick={() => openSupport("call")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-semibold"><PhoneCall size={16} /> Call Oasis</button>
            </div>
          </div>
          <button type="button" onClick={() => navigate("/staff/login")} className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Admin Access</button>
        </div>
      </div>
    </div>
  );
};

export default BuyerLogin;