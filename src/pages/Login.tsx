import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import { getRoleDestination, fetchAuthRoleRecord, isInternalStaffUser, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";

type AuthTab = "msg91" | "email";

// MSG91 Widget configuration (Token Auth + Widget ID)
const MSG91_WIDGET_ID = "3664766e464b383030383331";
const MSG91_TOKEN_AUTH = "509994T6SRbi4LqM69ea72d0P1";

declare global {
  interface Window {
    initSendOTP?: (cfg: any) => void;
  }
}

const AUTH_CACHE_KEY = "oasis_auth_cache";

const Login = () => {
  const [activeTab, setActiveTab] = useState<AuthTab>("msg91");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  // WhatsApp OTP state
  const [waPhone, setWaPhone] = useState("");
  const [waOtp, setWaOtp] = useState("");
  const [waOtpSent, setWaOtpSent] = useState(false);
  const emailBackupTimer = useState<{ id: ReturnType<typeof setTimeout> | null }>({ id: null })[0];
  const [msg91Loading, setMsg91Loading] = useState(false);
  // `isMsg91Ready` flips true ONLY after `otp-provider.js` is loaded AND
  // `window.initSendOTP` is callable. Pre-emptively loaded on mount (see
  // useEffect below) so the first user click is never a "premature click".
  const [isMsg91Ready, setIsMsg91Ready] = useState(false);
  // Retry guard so the silent re-attempt on AuthenticationFailure runs once.
  const msg91RetriedRef = useRef(false);
  const navigate = useNavigate();

  // Load MSG91 OTP widget script once on mount; flip `isMsg91Ready` only
  // after the script's `onload` fires AND `window.initSendOTP` is exposed.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const markReadyWhenAvailable = () => {
      if (typeof window.initSendOTP === "function") {
        setIsMsg91Ready(true);
        return true;
      }
      return false;
    };

    // Already injected (HMR / re-mount): just probe.
    const existing = document.getElementById("msg91-otp-provider") as HTMLScriptElement | null;
    if (existing) {
      if (markReadyWhenAvailable()) return;
      existing.addEventListener("load", () => markReadyWhenAvailable(), { once: true });
      // Poll briefly in case the script already loaded but global isn't bound yet.
      let tries = 0;
      const poll = setInterval(() => {
        if (markReadyWhenAvailable() || ++tries > 20) clearInterval(poll);
      }, 250);
      return () => clearInterval(poll);
    }

    const script = document.createElement("script");
    script.id = "msg91-otp-provider";
    script.src = "https://verify.msg91.com/otp-provider.js";
    script.async = true;
    script.onload = () => {
      // Some browsers expose initSendOTP a tick later; poll briefly.
      if (markReadyWhenAvailable()) return;
      let tries = 0;
      const poll = setInterval(() => {
        if (markReadyWhenAvailable() || ++tries > 20) clearInterval(poll);
      }, 250);
    };
    script.onerror = () => {
      console.error("[msg91] Failed to load otp-provider.js — possible IP block, network failure, or CSP. Falling back to Email login.");
      toast.error(
        "MSG91 widget unavailable. This may be a temporary IP block — please wait ~15 minutes and retry, or use Email login to continue.",
        { duration: 10000 },
      );
      setActiveTab("email");
    };
    document.body.appendChild(script);
  }, []);

  // Trigger MSG91 widget. On success → mint session via edge function → role-redirect.
  // `isSilentRetry` is true when re-invoked automatically after an AuthenticationFailure
  // — known race where the very first widget handshake fails but the second succeeds.
  const launchMsg91Widget = (isSilentRetry = false) => {
    if (!isSilentRetry) msg91RetriedRef.current = false;
    if (typeof window === "undefined" || !isMsg91Ready || typeof window.initSendOTP !== "function") {
      toast.error("MSG91 widget is still loading — please retry in a moment.");
      return;
    }
    // Guard: ensure widget credentials are present before attempting handshake.
    if (!MSG91_WIDGET_ID || !MSG91_TOKEN_AUTH) {
      console.error("[msg91] Missing widgetId or tokenAuth — aborting init.");
      toast.error("Handshake Failed: MSG91 widget is not configured.");
      return;
    }

    // Domain-mismatch (CORS) detector — MSG91 blocks non-whitelisted origins
    // silently, so we listen for the matching console error window during init.
    const origin = typeof window !== "undefined" ? window.location.origin : "unknown";
    const handlePossibleCorsError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const msg = (event as any)?.message || (event as any)?.reason?.message || "";
      if (typeof msg === "string" && /msg91|cors|access-control-allow-origin/i.test(msg)) {
        console.error(`[msg91] Domain Mismatch (CORS) suspected for origin: ${origin}. Whitelist this domain in your MSG91 Widget settings.`);
        toast.error("Handshake Failed: Please ensure this domain is whitelisted in your MSG91 Widget settings.", { duration: 8000 });
      }
    };
    window.addEventListener("error", handlePossibleCorsError as EventListener, { once: true });
    window.addEventListener("unhandledrejection", handlePossibleCorsError as EventListener, { once: true });
    // Cleanup listeners after 10s — handshake completes well before this.
    setTimeout(() => {
      window.removeEventListener("error", handlePossibleCorsError as EventListener);
      window.removeEventListener("unhandledrejection", handlePossibleCorsError as EventListener);
    }, 10000);

    setMsg91Loading(true);

    // 5-second handshake timeout — MSG91 sometimes silently hangs when the
    // domain isn't whitelisted or the widget config is stale. Reset state
    // and surface a clear message to the user.
    let handshakeSettled = false;
    const handshakeTimeout = setTimeout(() => {
      if (handshakeSettled) return;
      handshakeSettled = true;
      setMsg91Loading(false);
      console.error(`[msg91] Handshake timeout (5s) on origin: ${origin}. Check MSG91 Dashboard / domain whitelist.`);
      toast.error(
        "Connection Timeout. If this keeps failing, your IP may be temporarily blocked by MSG91 — please wait ~15 minutes and retry, or use Email login.",
        { duration: 10000 },
      );
    }, 5000);
    const settleHandshake = () => {
      handshakeSettled = true;
      clearTimeout(handshakeTimeout);
    };

    try {
      window.initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_TOKEN_AUTH,
        exposeMethods: false,
      success: async (data: any) => {
        settleHandshake();
        // Widget returns an access-token; verify it server-side before trusting.
        const accessToken =
          (typeof data === "string" ? data : null) ||
          data?.message ||
          data?.["access-token"] ||
          data?.accessToken ||
          null;
        // Try to extract the verified phone the widget collected so backend can mint a session.
        const verifiedPhone =
          data?.mobile ||
          data?.phone ||
          data?.message?.mobile ||
          data?.data?.mobile ||
          null;
        if (!accessToken) {
          setMsg91Loading(false);
          toast.error("Security Breach: OTP Verification Failed.");
          return;
        }
        try {
          const { data: verifyRes, error } = await supabase.functions.invoke("msg91-otp", {
            body: { mode: "verify_widget", accessToken, phone: verifiedPhone },
          });
          if (error || !verifyRes?.ok || verifyRes?.type !== "success") {
            setMsg91Loading(false);
            toast.error("Security Breach: OTP Verification Failed.");
            return;
          }

          // ── Establish a real Supabase session via the magiclink token_hash ──
          if (verifyRes.token_hash) {
            const { data: sess, error: sessErr } = await supabase.auth.verifyOtp({
              token_hash: verifyRes.token_hash,
              type: "magiclink",
            });
            if (!sessErr && sess?.user) {
              toast.success("Identity Verified — signing you in…");
              await resolveRedirect(sess.user.id);
              setMsg91Loading(false);
              return;
            }
            console.warn("[msg91] token_hash redemption failed:", sessErr?.message);
          }

          // Fallback: verification succeeded but session minting failed — bounce to WelcomeGate.
          setMsg91Loading(false);
          toast.success("Identity Verified via MSG91");
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await resolveRedirect(session.user.id);
          } else {
            toast.info("Verified, but unable to start your session automatically. Please use Email or WhatsApp login.", { duration: 7000 });
          }
        } catch (err) {
          setMsg91Loading(false);
          toast.error("Security Breach: OTP Verification Failed.");
        }
      },
      failure: (err: any) => {
        settleHandshake();
        const errMsg = err?.message || err?.errorMessage || err?.type || "";
        const isAuthFail = /authentication\s*fail|authfail|invalid\s*auth/i.test(errMsg);
        // Silent auto-retry: known MSG91 race where the first handshake fails
        // with AuthenticationFailure but the second click succeeds.
        if (isAuthFail && !msg91RetriedRef.current) {
          msg91RetriedRef.current = true;
          console.warn("[msg91] AuthenticationFailure on first attempt — silent retry…");
          setTimeout(() => launchMsg91Widget(true), 250);
          return;
        }
        setMsg91Loading(false);
        if (/cors|origin|domain|access-control/i.test(errMsg)) {
          console.error(`[msg91] Domain Mismatch (CORS) on origin: ${origin}. Whitelist this domain in your MSG91 Widget settings.`, err);
          toast.error("Handshake Failed: Please ensure this domain is whitelisted in your MSG91 Widget settings.", { duration: 8000 });
        } else {
          toast.error(errMsg || "MSG91 verification failed");
        }
      },
      });
    } catch (initErr: any) {
      settleHandshake();
      setMsg91Loading(false);
      console.error(`[msg91] initSendOTP threw on origin: ${origin}. Likely Domain Mismatch (CORS).`, initErr);
      toast.error("Handshake Failed: Please ensure this domain is whitelisted in your MSG91 Widget settings.", { duration: 8000 });
    }
  };

  const resolveRedirect = async (userId: string) => {
    const [authRecord, isInternalStaff] = await Promise.all([
      fetchAuthRoleRecord(userId),
      isInternalStaffUser(userId),
    ]);

    const resolvedRole = normalizeRole(authRecord.role);
    const destination = !resolvedRole
      ? isInternalStaff
        ? "/operations-controller"
        : "/approval-pending"
      : isStorefrontRole(resolvedRole) && !authRecord.company_id
        ? "/approval-pending"
        : getRoleDestination(resolvedRole);

    try {
      localStorage.setItem(
        AUTH_CACHE_KEY,
        JSON.stringify({
          userId,
          companyId: authRecord.company_id ?? null,
          role: resolvedRole,
          priceTier: null,
        }),
      );
    } catch {}

    if (isStorefrontRole(resolvedRole) && authRecord.company_id) {
      window.location.assign("/welcome");
    } else {
      window.location.assign(destination);
    }
  };

  // ── Email Login ──
  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!sessionStorage.getItem("oasis_welcomed")) {
      toast.success("Welcome back!");
      sessionStorage.setItem("oasis_welcomed", "1");
    }
    await resolveRedirect(data.user.id);
  };

  // ── Phone OTP & WhatsApp OTP handlers removed — superseded by MSG91 omnichannel widget ──

  const handleResetPassword = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://b2b.oasisbaklawa.com/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  const tabClass = (tab: AuthTab) =>
    `flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
      activeTab === tab
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" className="h-10 sm:h-12 mx-auto object-contain" />
          <h1 className="font-display text-3xl tracking-wide text-foreground">Welcome Back</h1>
          <p className="font-body text-sm text-muted-foreground">Sign in to your B2B account</p>
        </div>

        <div className="bg-card rounded-2xl p-6 space-y-5 border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          {/* Tab Toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted">
            <button onClick={() => setActiveTab("msg91")} className={tabClass("msg91")}>
              <ShieldCheck size={12} className="inline mr-1 -mt-0.5" />Mobile Verification
            </button>
            <button onClick={() => setActiveTab("email")} className={tabClass("email")}>
              <Mail size={12} className="inline mr-1 -mt-0.5" />Email
            </button>
          </div>

          {/* ── MSG91 Secure OTP Tab ── */}
          {activeTab === "msg91" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                <ShieldCheck size={28} className="mx-auto text-primary" />
                <p className="font-ui text-sm font-bold text-foreground">Secure Mobile Verification</p>
                <p className="font-body text-xs text-muted-foreground">
                  Verification via SMS, WhatsApp, or Voice.
                </p>
              </div>
              <button
                onClick={() => launchMsg91Widget()}
                disabled={msg91Loading || !isMsg91Ready}
                style={{ backgroundColor: "#C5A059", color: "#1A1A1A" }}
                className="w-full py-3.5 rounded-xl font-ui font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:brightness-110 disabled:opacity-60 ring-1 ring-[#a8884a]"
              >
                {(msg91Loading || !isMsg91Ready) ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {!isMsg91Ready ? "Loading secure widget…" : msg91Loading ? "Launching widget…" : "Verify with MSG91"}
              </button>
            </div>
          )}

          {/* Phone & WhatsApp tabs removed — MSG91 omnichannel widget handles all phone/WA verification */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@business.com"
                  className="rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    className="rounded-xl pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
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
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-ui font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? "Signing in…" : "Login"}
              </button>

              <p className="font-body text-xs text-center text-muted-foreground">
                Forgot password?{" "}
                <button onClick={handleResetPassword} className="text-primary font-semibold hover:underline">
                  Reset it
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Social Login Options */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground font-medium">or continue with</span></div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: "https://b2b.oasisbaklawa.com/auth/callback" },
                });
                if (error) {
                  if (error.message?.includes("provider") || error.message?.includes("enabled")) {
                    toast.info("Google login is being configured. Please use WhatsApp or Email login for now.", { duration: 5000 });
                  } else {
                    toast.error(error.message);
                  }
                }
              }}
              className="flex-1 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            {/* Apple login hidden for Phase 1 launch */}
          </div>
        </div>

        <div className="text-center">
          <p className="font-body text-sm text-muted-foreground">
            New to Oasis Baklawa?{" "}
            <button onClick={() => navigate("/register")} className="text-primary font-semibold hover:underline">
              Apply for B2B Access
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
