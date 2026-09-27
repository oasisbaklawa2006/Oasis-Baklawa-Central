import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Mail, MessageCircle, Phone, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import {
  createAuthStateController,
  readAuthCache,
  redirectAfterAuth,
  type AuthStatus,
} from "@/lib/auth-flow";
import { invokeApprovedB2bIdentityClaimRpc } from "@/lib/approved-b2b-claim-invoke";
import {
  assertApprovedB2bClaimBound,
  claimApprovedB2bIdentityForAuthenticatedSession,
} from "@/lib/b2b-approved-identity-claim";
import { mapBuyerOtpProviderError, mapBuyerPostMintAuthError } from "@/lib/buyer-login-errors";
import { extractEdgeFunctionErrorCode } from "@/lib/edge-function-errors";
import { createAuthAttemptId, logAuthEvent, type AuthAttemptMethod } from "@/lib/auth-logging";
import { isEmailIdentifier, normalizeIdentifier, normalizePhone } from "@/lib/auth-identity";
import { signOutAndClearSession } from "@/utils/authSession";

// Browser widget configuration only. MSG91 provider authkey remains Edge-only.
const MSG91_WIDGET_ID = "3664766e464b383030383331";
const MSG91_TOKEN_AUTH = "509994T6SRbi4LqM69ea72d0P1";
const MSG91_PROVIDER_SCRIPT_ID = "msg91-otp-provider";
const MSG91_CAPTCHA_ID = "msg91-captcha";
const MSG91_CAPTCHA_REQUIRED_MESSAGE = "Please complete the security check above before requesting an OTP.";
const MSG91_PROVIDER_CALL_TIMEOUT_MS = 12_000;
const MSG91_EDGE_TIMEOUT_MS = 15_000;
const MSG91_SDK_POLL_INTERVAL_MS = 125;
const MSG91_SDK_POLL_ATTEMPTS = 64;

const SUPPORT_EMAIL = "support@oasisbaklawa.com";
const SUPPORT_WHATSAPP = (import.meta.env.VITE_B2B_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const SUPPORT_PHONE = import.meta.env.VITE_B2B_SUPPORT_PHONE || "";

type BuyerLoginChannel = "mobile" | "email" | null;
type EligibilityState = "approved" | "pending" | "employee" | "rejected" | "unknown" | "ambiguous" | null;
type Msg91Callback = (payload: unknown) => void;
type SessionBridge = "msg91-otp" | "msg91-email-session";

type PreflightResponse = {
  ok?: boolean;
  state?: Exclude<EligibilityState, null>;
  allowOtp?: boolean;
  message?: string;
  error?: string;
};

declare global {
  interface Window {
    initSendOTP?: (cfg: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
    verifyOtp?: (otp: number | string, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
    retryOtp?: (channel: string | null, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void;
    isCaptchaVerified?: () => boolean;
  }
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function maskMintEmail(email: string) {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
}

function isMsg91CaptchaRequiredAndUnverified() {
  if (typeof window === "undefined" || typeof window.isCaptchaVerified !== "function") return false;
  try {
    return !window.isCaptchaVerified();
  } catch {
    return true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMsg91AccessToken(payload: any) {
  return firstNonEmptyString(
    typeof payload === "string" ? payload : null,
    payload?.["access-token"], payload?.accessToken, payload?.access_token,
    typeof payload?.message === "string" ? payload.message : null,
    payload?.message?.["access-token"], payload?.message?.accessToken, payload?.message?.access_token,
    payload?.data?.message, payload?.data?.["access-token"], payload?.data?.accessToken, payload?.data?.access_token,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMsg91RequestId(payload: any) {
  return firstNonEmptyString(
    payload?.reqId, payload?.req_id, payload?.requestId, payload?.request_id,
    payload?.message?.reqId, payload?.message?.requestId,
    payload?.data?.reqId, payload?.data?.requestId,
  );
}

function providerErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return firstNonEmptyString(record.message, record.errorMessage, record.error, record.type) ?? "otp_request_failed";
  }
  return typeof error === "string" ? error : "otp_request_failed";
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
  const [emailReqId, setEmailReqId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [eligibilityState, setEligibilityState] = useState<EligibilityState>(null);
  const [loading, setLoading] = useState(false);
  const [isMsg91Ready, setIsMsg91Ready] = useState(false);
  const [securityRetryNonce, setSecurityRetryNonce] = useState(0);
  const controllerRef = useRef(createAuthStateController("idle"));
  const attemptRef = useRef<{ id: string; method: AuthAttemptMethod; identifier: string | null } | null>(null);
  const providerLoadRef = useRef<Promise<void> | null>(null);
  const providerInitializedRef = useRef(false);

  const isMinting = useMemo(() => {
    const minting = [
      "verifying_otp", "verification_success", "session_creation_in_progress",
      "account_resolution_in_progress", "profile_loading", "role_loading",
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

  const resetMsg91Provider = useCallback(() => {
    providerLoadRef.current = null;
    providerInitializedRef.current = false;
    setIsMsg91Ready(false);
    if (typeof document !== "undefined") document.getElementById(MSG91_PROVIDER_SCRIPT_ID)?.remove();
    if (typeof window !== "undefined") {
      delete window.initSendOTP;
      delete window.sendOtp;
      delete window.verifyOtp;
      delete window.retryOtp;
      delete window.isCaptchaVerified;
    }
  }, []);

  const loadMsg91Script = useCallback((force = false) => {
    if (typeof window === "undefined") return Promise.resolve();
    if (force) resetMsg91Provider();
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
          } else if (attempts >= MSG91_SDK_POLL_ATTEMPTS) {
            window.clearInterval(poll);
            providerLoadRef.current = null;
            reject(new Error("msg91_provider_load_timeout"));
          }
        }, MSG91_SDK_POLL_INTERVAL_MS);
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
      script.src = `https://verify.msg91.com/otp-provider.js?oasis=${Date.now()}`;
      script.async = true;
      script.onload = awaitSdk;
      script.onerror = () => {
        providerLoadRef.current = null;
        reject(new Error("msg91_provider_load_failed"));
      };
      document.body.appendChild(script);
    });

    return providerLoadRef.current;
  }, [resetMsg91Provider]);

  const initializeMsg91CustomUi = useCallback(async () => {
    await loadMsg91Script();
    if (typeof window === "undefined" || typeof window.initSendOTP !== "function") throw new Error("msg91_provider_unavailable");

    if (!providerInitializedRef.current) {
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: true,
        identifier: "",
        "country-code": "91",
        "auto-country": false,
        captchaRenderId: MSG91_CAPTCHA_ID,
        success: () => {},
        failure: () => {},
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
        } else if (attempts >= MSG91_SDK_POLL_ATTEMPTS) {
          window.clearInterval(poll);
          providerInitializedRef.current = false;
          reject(new Error("msg91_custom_methods_unavailable"));
        }
      }, MSG91_SDK_POLL_INTERVAL_MS);
    });
  }, [loadMsg91Script]);

  const ensureMsg91CustomUi = useCallback(async () => {
    try {
      await initializeMsg91CustomUi();
    } catch {
      resetMsg91Provider();
      await loadMsg91Script(true);
      await initializeMsg91CustomUi();
    }
  }, [initializeMsg91CustomUi, loadMsg91Script, resetMsg91Provider]);

  useEffect(() => {
    updateStatus("entering_identifier", { result: "info" });
    return () => controllerRef.current.finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!channel) return;
    void ensureMsg91CustomUi().catch(() => {
      setIsMsg91Ready(false);
      setStatusMessage("The security check is taking too long to load. Tap Retry security check.");
    });
  }, [channel, ensureMsg91CustomUi, securityRetryNonce]);

  const invokePreflight = async (targetChannel: "mobile" | "email", identifier: string, attemptId: string) => {
    const { data, error } = await supabase.functions.invoke("buyer-login-gateway", {
      body: { mode: "preflight", channel: targetChannel, identifier, attemptId },
    });
    if (error) throw new Error(error.message);
    return (data || {}) as PreflightResponse;
  };

  const applyEligibility = (preflight: PreflightResponse) => {
    const state = preflight.state ?? "ambiguous";
    setEligibilityState(state);
    if (preflight.message) setStatusMessage(preflight.message);
    if (preflight.allowOtp) return true;
    updateStatus("failed", { result: "info", error: state });
    setLoading(false);
    return false;
  };

  const runApprovedClaim = async (attemptId: string, method: AuthAttemptMethod, identifier: string, requireBound: boolean) => {
    logAuthEvent("APPROVED_B2B_CLAIM_STARTED", { attemptId, method, identifier, result: "started" });
    const currentSession = (await supabase.auth.getSession()).data.session;
    const claimOutcome = await claimApprovedB2bIdentityForAuthenticatedSession(
      invokeApprovedB2bIdentityClaimRpc,
      async () => Boolean(currentSession?.access_token || (await supabase.auth.getSession()).data.session?.access_token),
    );
    assertApprovedB2bClaimBound(claimOutcome, requireBound);
    logAuthEvent("APPROVED_B2B_CLAIM_SUCCESS", {
      attemptId,
      method,
      identifier,
      result: "success",
      details: {
        claimed: claimOutcome.claimed,
        alreadyActive: claimOutcome.alreadyActive,
        applicationId: claimOutcome.applicationId,
        companyId: claimOutcome.companyId,
      },
    });
    return claimOutcome;
  };

  const verifiedProviderSession = async (
    payload: unknown,
    identifier: string,
    attemptId: string,
    method: AuthAttemptMethod,
    bridge: SessionBridge,
  ) => {
    const accessToken = extractMsg91AccessToken(payload);
    if (!accessToken) {
      await finalizeFailure("MSG91 verified the OTP but did not return a verification token. Please request a new OTP.");
      return;
    }

    updateStatus("verifying_otp", { result: "started" });
    const abortController = controllerRef.current.createAbortController();
    let edgeTimedOut = false;
    const edgeTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
      edgeTimedOut = true;
      abortController.abort();
    }, MSG91_EDGE_TIMEOUT_MS));
    let edgeVerified = false;

    try {
      const invokeBody = bridge === "msg91-otp"
        ? { mode: "verify_widget", accessToken, phone: identifier, attemptId }
        : { accessToken, email: identifier, attemptId };
      const invokeResult = await supabase.functions.invoke(bridge, { body: invokeBody, signal: abortController.signal });
      const { data: verifyRes, error: invokeError, response: invokeResponse } = invokeResult;
      controllerRef.current.clearTimer(edgeTimeout);
      const edgeErrorCode = await extractEdgeFunctionErrorCode({ data: verifyRes, error: invokeError, response: invokeResponse });
      if (edgeErrorCode) throw new Error(edgeErrorCode);
      if (!verifyRes?.ok) throw new Error(verifyRes?.error || verifyRes?.reason || "provider_verification_failed");
      if (!verifyRes?.token_hash || !verifyRes?.user_id) throw new Error("session_token_missing");

      const resolvedIdentifier = firstNonEmptyString(
        bridge === "msg91-email-session" ? verifyRes?.verified_email : verifyRes?.phone,
        identifier,
      ) ?? identifier;
      const normalizedIdentifier = normalizeIdentifier(resolvedIdentifier).normalized;
      attemptRef.current = { id: attemptId, method, identifier: normalizedIdentifier };
      edgeVerified = true;
      logAuthEvent("OTP_VERIFY_SUCCESS", {
        attemptId,
        method,
        identifier: normalizedIdentifier,
        result: "success",
        details: { userId: verifyRes.user_id },
      });

      updateStatus("verification_success", { result: "success" });
      updateStatus("session_creation_in_progress", { result: "started" });
      const mintEmail = firstNonEmptyString(verifyRes?.email);
      logAuthEvent("SESSION_CREATE_STARTED", {
        attemptId,
        method,
        identifier: normalizedIdentifier,
        result: "started",
        details: {
          userId: verifyRes.user_id,
          mintEmailPresent: Boolean(mintEmail),
          ...(mintEmail ? { mintEmail: maskMintEmail(mintEmail) } : {}),
        },
      });

      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyRes.token_hash,
        type: "email",
      });
      if (sessionError || !sessionData.user) {
        const sessionFailure = sessionError?.message || "session_create_failed";
        logAuthEvent("SESSION_CREATE_FAILED", {
          attemptId,
          method,
          identifier: normalizedIdentifier,
          result: "failed",
          error: sessionFailure,
          details: { userId: verifyRes.user_id, mintEmailPresent: Boolean(mintEmail) },
        });
        throw new Error(sessionFailure);
      }

      logAuthEvent("SESSION_CREATE_SUCCESS", {
        attemptId,
        method,
        identifier: normalizedIdentifier,
        result: "success",
        details: { userId: sessionData.user.id, edgeIsNew: Boolean(verifyRes?.is_new) },
      });

      await runApprovedClaim(attemptId, method, normalizedIdentifier, Boolean(verifyRes?.approved_b2b_pending_claim));
      await runRedirectAfterAuth(normalizedIdentifier, method, sessionData.user.id, attemptId);
      controllerRef.current.finalize();
      setLoading(false);
    } catch (error) {
      controllerRef.current.clearTimer(edgeTimeout);
      const raw = edgeTimedOut ? "session_token_mint_timeout" : error instanceof Error ? error.message : "buyer_session_failed";
      const mapped = mapBuyerPostMintAuthError(edgeTimedOut ? new Error("session_token_mint_timeout") : error);
      if (mapped.stage === "approved_b2b_claim") {
        logAuthEvent("APPROVED_B2B_CLAIM_FAILED", { attemptId, method, identifier, result: "failed", error: raw });
      } else if (edgeVerified) {
        logAuthEvent("SESSION_CREATE_FAILED", { attemptId, method, identifier, result: "failed", error: raw });
      } else {
        logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier, result: "failed", error: raw });
      }
      await finalizeFailure(mapped.message, true);
    }
  };

  const requestProviderOtp = async (
    identifier: string,
    targetChannel: "mobile" | "email",
    method: AuthAttemptMethod,
    setSent: (value: boolean) => void,
    setReqId: (value: string | null) => void,
    setOtp: (value: string) => void,
  ) => {
    const attemptId = createAuthAttemptId();
    attemptRef.current = { id: attemptId, method, identifier: normalizeIdentifier(identifier).normalized };
    setLoading(true);
    setEligibilityState(null);
    setStatusMessage(null);
    updateStatus("sending_otp", { result: "started" });
    logAuthEvent("AUTH_START", { attemptId, method, identifier, result: "started" });

    try {
      const preflight = await invokePreflight(targetChannel, identifier, attemptId);
      if (!applyEligibility(preflight)) return;
      await ensureMsg91CustomUi();
      if (isMsg91CaptchaRequiredAndUnverified()) {
        logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: "msg91_captcha_required" });
        await finalizeFailure(MSG91_CAPTCHA_REQUIRED_MESSAGE);
        return;
      }
      if (typeof window.sendOtp !== "function") throw new Error("msg91_send_method_unavailable");

      logAuthEvent("OTP_REQUEST_STARTED", { attemptId, method, identifier, result: "started" });
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        attemptRef.current = null;
        logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: "msg91_send_timeout" });
        void finalizeFailure("OTP request timed out. Retry the security check and try again.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));

      window.sendOtp(
        identifier,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const reqId = extractMsg91RequestId(payload);
          setReqId(reqId);
          setSent(true);
          setOtp("");
          setLoading(false);
          updateStatus("otp_sent", { result: "success", details: { requestIdPresent: Boolean(reqId) } });
          logAuthEvent("OTP_REQUEST_SUCCESS", {
            attemptId, method, identifier, result: "success",
            details: { requestIdPresent: Boolean(reqId), providerAcknowledged: true },
          });
          setStatusMessage(
            targetChannel === "mobile"
              ? "OTP request accepted by MSG91. Check your phone for a fresh code before continuing."
              : "Email OTP request accepted by MSG91. Check your registered email for a fresh code before continuing.",
          );
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const message = providerErrorMessage(error);
          logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: message });
          void finalizeFailure(mapBuyerOtpProviderError(message));
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "otp_request_failed";
      logAuthEvent("OTP_REQUEST_FAILED", { attemptId, method, identifier, result: "failed", error: message });
      await finalizeFailure("Verification could not start. Retry the security check and try again.");
    }
  };

  const sendMobileOtp = async () => {
    const phone = normalizePhone(mobile);
    if (!phone.last10 || phone.last10.length !== 10) {
      setAuthStatus("failed");
      setStatusMessage("Enter a valid registered mobile number.");
      return;
    }
    await requestProviderOtp(`91${phone.last10}`, "mobile", "mobile_otp", setMobileOtpSent, setMobileReqId, setMobileOtp);
  };

  const sendEmailOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!isEmailIdentifier(trimmedEmail)) {
      setAuthStatus("failed");
      setStatusMessage("Enter a valid registered email address.");
      return;
    }
    await requestProviderOtp(trimmedEmail, "email", "email_otp", setEmailOtpSent, setEmailReqId, setEmailOtp);
  };

  const verifyProviderOtp = async (
    otpInput: string,
    identifier: string,
    reqId: string | null,
    method: AuthAttemptMethod,
    bridge: SessionBridge,
  ) => {
    const otp = otpInput.replace(/\D/g, "");
    if (otp.length < 4 || otp.length > 8) {
      setAuthStatus("failed");
      setStatusMessage("Enter the OTP you just received.");
      return;
    }
    const attemptId = attemptRef.current?.id || createAuthAttemptId();
    attemptRef.current = { id: attemptId, method, identifier: normalizeIdentifier(identifier).normalized };
    setLoading(true);
    setStatusMessage(null);
    updateStatus("verifying_otp", { result: "started" });
    logAuthEvent("OTP_VERIFY_STARTED", { attemptId, method, identifier, result: "started" });

    try {
      await ensureMsg91CustomUi();
      if (typeof window.verifyOtp !== "function") throw new Error("msg91_verify_method_unavailable");
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        attemptRef.current = null;
        logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier, result: "failed", error: "msg91_verify_timeout" });
        void finalizeFailure("OTP verification timed out. Please retry.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));

      window.verifyOtp(
        otp,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          void verifiedProviderSession(payload, identifier, attemptId, method, bridge);
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          const message = providerErrorMessage(error);
          logAuthEvent("OTP_VERIFY_FAILED", { attemptId, method, identifier, result: "failed", error: message });
          void finalizeFailure(mapBuyerOtpProviderError(message));
        },
        reqId ?? undefined,
      );
    } catch (error) {
      await finalizeFailure(mapBuyerOtpProviderError(error instanceof Error ? error.message : "otp_verify_failed"));
    }
  };

  const verifyMobileOtp = async () => {
    const phone = normalizePhone(mobile);
    if (!mobileOtpSent || !phone.last10) return void setStatusMessage("Request a fresh mobile OTP first.");
    await verifyProviderOtp(mobileOtp, `91${phone.last10}`, mobileReqId, "mobile_otp", "msg91-otp");
  };

  const verifyEmailOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!emailOtpSent || !isEmailIdentifier(trimmedEmail)) return void setStatusMessage("Request a fresh email OTP first.");
    await verifyProviderOtp(emailOtp, trimmedEmail, emailReqId, "email_otp", "msg91-email-session");
  };

  const retryProviderOtp = async (
    reqId: string | null,
    method: AuthAttemptMethod,
    identifier: string,
    setReqId: (value: string | null) => void,
    setOtp: (value: string) => void,
    fallback: () => Promise<void>,
  ) => {
    const attemptId = attemptRef.current?.id;
    if (!attemptId) return void fallback();
    setLoading(true);
    setStatusMessage(null);
    try {
      await ensureMsg91CustomUi();
      if (isMsg91CaptchaRequiredAndUnverified()) return void finalizeFailure(MSG91_CAPTCHA_REQUIRED_MESSAGE);
      if (typeof window.retryOtp !== "function") {
        setLoading(false);
        return void fallback();
      }
      const callbackTimeout = controllerRef.current.registerTimer(window.setTimeout(() => {
        if (attemptRef.current?.id !== attemptId) return;
        attemptRef.current = null;
        void finalizeFailure("OTP resend timed out. Please retry.");
      }, MSG91_PROVIDER_CALL_TIMEOUT_MS));
      window.retryOtp(
        null,
        (payload) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          setReqId(extractMsg91RequestId(payload) ?? reqId);
          setOtp("");
          setLoading(false);
          logAuthEvent("OTP_REQUEST_SUCCESS", { attemptId, method, identifier, result: "success", details: { retry: true } });
          setStatusMessage("A fresh OTP request was accepted. Check the same verified channel before continuing.");
        },
        (error) => {
          if (attemptRef.current?.id !== attemptId) return;
          controllerRef.current.clearTimer(callbackTimeout);
          void finalizeFailure(mapBuyerOtpProviderError(providerErrorMessage(error)));
        },
        reqId ?? undefined,
      );
    } catch {
      setLoading(false);
      await fallback();
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
    setEmailReqId(null);
    setStatusMessage(null);
    setEligibilityState(null);
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

  const retrySecurityCheck = () => {
    resetMsg91Provider();
    setStatusMessage("Reloading the security check…");
    setSecurityRetryNonce((value) => value + 1);
  };

  const SecurityCheck = () => (
    <>
      <div id={MSG91_CAPTCHA_ID} />
      {!isMsg91Ready && (
        <button type="button" onClick={retrySecurityCheck} className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground flex items-center justify-center gap-2">
          <RefreshCw size={14} /> Retry security check
        </button>
      )}
    </>
  );

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
          <h1 className="text-3xl text-foreground">B2B Client Login</h1>
          <p className="text-sm text-muted-foreground">Use the mobile number or email approved with your Oasis B2B access request.</p>
        </div>

        {channel === null && (
          <div className="space-y-3">
            <button type="button" onClick={() => { setChannel("mobile"); setStatusMessage(null); setEligibilityState(null); }} className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Phone size={21} /></span>
                <span><span className="block text-sm font-bold text-foreground">Mobile OTP</span><span className="mt-1 block text-xs text-muted-foreground">Approved Buyers verify through MSG91.</span></span>
              </span>
            </button>
            <button type="button" onClick={() => { setChannel("email"); setStatusMessage(null); setEligibilityState(null); }} className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary/40">
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail size={21} /></span>
                <span><span className="block text-sm font-bold text-foreground">Email OTP</span><span className="mt-1 block text-xs text-muted-foreground">Approved Buyers verify through MSG91 email OTP.</span></span>
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
              <p className="text-xs text-muted-foreground">We confirm B2B eligibility before MSG91 can send a login OTP.</p>
            </div>
            <SecurityCheck />
            <div className="space-y-2">
              <label htmlFor="buyer-mobile" className="text-xs font-semibold text-foreground">Registered mobile number</label>
              <Input id="buyer-mobile" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" value={mobile} disabled={mobileOtpSent} onChange={(event) => setMobile(event.target.value)} className="rounded-xl" />
            </div>
            {!mobileOtpSent ? (
              <button type="button" onClick={() => void sendMobileOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {loading ? "Checking access…" : "Continue with mobile OTP"}
              </button>
            ) : (
              <div className="space-y-3">
                <Input id="buyer-mobile-otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter OTP" value={mobileOtp} onChange={(event) => setMobileOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} className="rounded-xl tracking-[0.25em] text-center" />
                <button type="button" onClick={() => void verifyMobileOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Verify and continue
                </button>
                <button type="button" onClick={() => void retryProviderOtp(mobileReqId, "mobile_otp", normalizePhone(mobile).e164 || mobile, setMobileReqId, setMobileOtp, sendMobileOtp)} disabled={loading} className="w-full py-2 text-xs font-semibold text-primary disabled:opacity-60">Resend mobile OTP</button>
              </div>
            )}
          </div>
        )}

        {channel === "email" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <button type="button" onClick={goBackToChannelChoice} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Change login method</button>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <Mail size={28} className="mx-auto text-primary" />
              <p className="text-sm font-bold text-foreground">Secure Email Verification</p>
              <p className="text-xs text-muted-foreground">Only an approved B2B email can receive a login OTP. No portal or magic-link redirect is used.</p>
            </div>
            <SecurityCheck />
            <div className="space-y-2">
              <label htmlFor="buyer-email" className="text-xs font-semibold text-foreground">Registered email</label>
              <Input id="buyer-email" type="email" autoComplete="email" placeholder="buyer@company.com" value={email} disabled={emailOtpSent} onChange={(event) => setEmail(event.target.value)} className="rounded-xl" />
            </div>
            {!emailOtpSent ? (
              <button type="button" onClick={() => void sendEmailOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {loading ? "Checking access…" : "Continue with email OTP"}
              </button>
            ) : (
              <div className="space-y-3">
                <Input id="buyer-email-otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} className="rounded-xl tracking-[0.25em] text-center" />
                <button type="button" onClick={() => void verifyEmailOtp()} disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Verify and continue
                </button>
                <button type="button" onClick={() => void retryProviderOtp(emailReqId, "email_otp", email.trim().toLowerCase(), setEmailReqId, setEmailOtp, sendEmailOtp)} disabled={loading} className="w-full py-2 text-xs font-semibold text-primary disabled:opacity-60">Resend email OTP</button>
              </div>
            )}
          </div>
        )}

        {statusMessage && (
          <div aria-live="polite" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground space-y-3">
            <p>{statusMessage}</p>
            {eligibilityState === "employee" && (
              <button type="button" onClick={() => navigate("/staff/login")} className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Go to Admin Login</button>
            )}
            {(eligibilityState === "unknown" || eligibilityState === "rejected") && (
              <button type="button" onClick={() => navigate("/buyer/access-request")} className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Request B2B Access</button>
            )}
          </div>
        )}

        <div className="border-t border-border pt-5 space-y-3 text-center">
          <button type="button" onClick={() => navigate("/buyer/access-request")} className="text-sm font-semibold text-primary">Request B2B Access</button>
          <div className="flex items-center justify-center gap-4 text-xs">
            <button type="button" onClick={() => openSupport("whatsapp")} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><MessageCircle size={14} /> WhatsApp Oasis</button>
            <button type="button" onClick={() => openSupport("call")} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><PhoneCall size={14} /> Call Oasis</button>
          </div>
          <button type="button" onClick={() => navigate("/staff/login")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Admin Access</button>
        </div>
      </div>
    </div>
  );
};

export default BuyerLogin;
