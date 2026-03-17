import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo-open.png";

const Login = () => {
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (userData?.role === "admin" || userData?.role === "super_admin") {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  const handleResetPassword = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ backgroundColor: "#f3f5f9" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" className="h-10 sm:h-12 mx-auto object-contain" />
          <h1 className="font-display text-3xl tracking-wide" style={{ color: "#1c1c1c" }}>Welcome Back</h1>
          <p className="font-body text-sm text-muted-foreground">Sign in to your B2B account</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-5" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div className="space-y-2">
            <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Email Address</label>
            <Input
              type="email"
              placeholder="you@business.com"
              className="rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="font-ui text-xs font-semibold" style={{ color: "#1c1c1c" }}>Password</label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                className="rounded-xl pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-ui font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-fab disabled:opacity-60"
            style={{ backgroundColor: "#c6a769", color: "#ffffff" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "Signing in…" : "Login"}
          </button>

          <p className="font-body text-xs text-center text-muted-foreground">
            Forgot password?{" "}
            <button onClick={handleResetPassword} className="font-semibold hover:underline" style={{ color: "#c6a769" }}>
              Reset it
            </button>
          </p>
        </div>

        <div className="text-center">
          <p className="font-body text-sm text-muted-foreground">
            New to Oasis Baklawa?{" "}
            <button onClick={() => navigate("/register")} className="font-semibold hover:underline" style={{ color: "#c6a769" }}>
              Apply for B2B Access
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
