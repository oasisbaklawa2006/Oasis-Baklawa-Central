import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import logoImg from "@/assets/logo-open.png";

const Login = () => {
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" className="h-16 mx-auto object-contain" />
          <h1 className="font-display text-3xl tracking-wide text-foreground">Welcome Back</h1>
          <p className="font-body text-sm text-muted-foreground">Sign in to your B2B account</p>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-6 space-y-5">
          <div className="space-y-2">
            <label className="font-body text-xs font-semibold text-foreground">Email Address</label>
            <Input type="email" placeholder="you@business.com" className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="font-body text-xs font-semibold text-foreground">Password</label>
            <div className="relative">
              <Input type={showPwd ? "text" : "password"} placeholder="••••••••" className="rounded-xl pr-10" />
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
            onClick={() => navigate("/")}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
          >
            <LogIn size={18} />
            Login
          </button>

          <p className="font-body text-xs text-center text-muted-foreground">
            Forgot password?{" "}
            <button className="text-primary font-semibold hover:underline">Reset it</button>
          </p>
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
