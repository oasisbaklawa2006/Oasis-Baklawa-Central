import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, Loader2, Phone, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";
import { getRoleDestination, fetchAuthRoleRecord } from "@/lib/auth-routing";

type AuthTab = "phone" | "email";

const Login = () => {
  const [activeTab, setActiveTab] = useState<AuthTab>("phone");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const resolveRedirect = async (userId: string) => {
    const authRecord = await fetchAuthRoleRecord(userId);
    navigate(getRoleDestination(authRecord.role), { replace: true });
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
    toast.success("Welcome back!");
    await resolveRedirect(data.user.id);
  };

  // ── Phone OTP ──
  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${cleaned}` });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setOtpSent(true);
    toast.success("OTP sent to your mobile number");
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { toast.error("Enter the 6-digit OTP"); return; }
    const cleaned = phone.replace(/\D/g, "");
    setLoading(true);
    const { error, data } = await supabase.auth.verifyOtp({
      phone: `+91${cleaned}`,
      token: otp,
      type: "sms",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back!");
    if (data.user) await resolveRedirect(data.user.id);
  };

  const handleResetPassword = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  const tabClass = (tab: AuthTab) =>
    `flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
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
            <button onClick={() => { setActiveTab("phone"); setOtpSent(false); setOtp(""); }} className={tabClass("phone")}>
              <Phone size={14} className="inline mr-1.5 -mt-0.5" />Phone Login
            </button>
            <button onClick={() => setActiveTab("email")} className={tabClass("email")}>
              <Mail size={14} className="inline mr-1.5 -mt-0.5" />Email Login
            </button>
          </div>

          {activeTab === "phone" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-ui text-xs font-semibold text-foreground">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 rounded-xl border border-input bg-muted text-sm font-semibold text-muted-foreground shrink-0">+91</div>
                  <Input
                    type="tel"
                    placeholder="10-digit mobile"
                    className="rounded-xl"
                    value={phone}
                    maxLength={10}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && !otpSent && handleSendOtp()}
                  />
                </div>
              </div>

              {otpSent && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <label className="font-ui text-xs font-semibold text-foreground">Enter 6-Digit OTP</label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Didn't receive it?{" "}
                    <button onClick={handleSendOtp} className="text-primary font-semibold hover:underline">Resend OTP</button>
                  </p>
                </motion.div>
              )}

              <button
                onClick={otpSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-ui font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
                {loading ? "Please wait…" : otpSent ? "Verify & Login" : "Send OTP"}
              </button>
            </div>
          ) : (
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
