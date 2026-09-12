import { ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/logo-open.png";

// /login is a neutral entry selector only. It never renders an OTP or
// password field itself — see /buyer/login (BuyerLogin.tsx) and
// /staff/login (StaffLogin.tsx) for the two authentication surfaces.
const AuthEntry = () => {
  const navigate = useNavigate();

  // Issue #561: B2B application is a governed pre-login intake.
  // Prospects may open the form directly; Core owns the anonymous write boundary.
  const handleApplyForB2BAccess = () => {
    navigate("/buyer/access-request");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Oasis Baklawa" width={134} height={96} fetchPriority="high" decoding="async" className="h-10 sm:h-12 w-auto mx-auto object-contain" />
          <h1 className="text-3xl text-foreground">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Choose how you'd like to sign in</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/buyer/login")}
            className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-foreground">B2B Client Login</span>
              <span className="block text-xs text-muted-foreground">Mobile verification for approved buyers</span>
            </span>
          </button>

          <button
            onClick={() => navigate("/staff/login")}
            className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-foreground">Oasis Staff Login</span>
              <span className="block text-xs text-muted-foreground">Email and password for Oasis employees</span>
            </span>
          </button>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            New to Oasis Baklawa?{" "}
            <button onClick={handleApplyForB2BAccess} className="text-primary font-semibold hover:underline">
              Apply for B2B Access
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthEntry;
