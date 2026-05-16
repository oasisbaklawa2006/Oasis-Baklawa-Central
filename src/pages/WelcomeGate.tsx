import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getRoleDestination, isStaffRole, normalizeRole } from "@/lib/auth-routing";

const GREETINGS = [
  { lang: "English", text: "Welcome" },
  { lang: "Hindi", text: "स्वागत है" },
  { lang: "Arabic", text: "أهلاً وسهلاً" },
  { lang: "Punjabi", text: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" },
];

const WelcomeGate = () => {
  const navigate = useNavigate();
  const { user, companyId, role, loading, profileReady, hasAppliedB2B, profileStatus } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [greetingIdx, setGreetingIdx] = useState(0);
  const normalizedRole = normalizeRole(role);
  const isStaff = normalizedRole ? isStaffRole(normalizedRole) : false;

  // OAuth callback recovery — bail to /login with guidance when the provider returns an error
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
    );
    const err = search.get("error") || hash.get("error");
    const errCode = search.get("error_code") || hash.get("error_code");
    if (err === "server_error" || errCode === "server_error" || err === "access_denied") {
      toast.error("We couldn’t complete sign-in. Please use mobile verification or email, or contact support@oasisbaklawa.com.", {
        duration: 8000,
      });
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Ready when: staff role known OR profile resolved (regardless of company linkage — pending users go to /approval-pending)
  const ready = !loading && (isStaff || profileReady);

  // Ensure an OAuth (Google/Apple) sign-in has a public.users row so role resolution works.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("users").insert({
            id: user.id,
            email: user.email ?? null,
            role: "PENDING",
          } as any);
        }
      } catch (e) {
        console.warn("[WelcomeGate] OAuth user-row sync soft-failed", e);
      }
    })();
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("companies")
      .select("business_name")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.business_name) setCompanyName(data.business_name);
      });
  }, [companyId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingIdx((prev) => (prev + 1) % GREETINGS.length);
    }, 700);
    return () => clearInterval(interval);
  }, []);

  // Auto-navigate only after auth+profile are ready. Three exact destinations, no hangs.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      let dest = "/register";
      if (isStaff) {
        dest = getRoleDestination(normalizedRole);
      } else if (companyId && normalizedRole && normalizedRole !== "PENDING") {
        dest = "/home";
      } else {
        const status = profileStatus?.trim().toLowerCase() ?? null;
        const isPendingApplicant =
          hasAppliedB2B || status === "pending" || status === "approved" || status === "rejected" || normalizedRole === "PENDING";
        dest = isPendingApplicant ? "/approval-pending" : "/register";
      }
      navigate(dest, { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [ready, isStaff, normalizedRole, companyId, hasAppliedB2B, profileStatus, navigate]);

  // If auth not loaded after a generous window, redirect to login
  useEffect(() => {
    if (user) return;
    const timeout = setTimeout(() => {
      if (!user) navigate("/login", { replace: true });
    }, 6000);
    return () => clearTimeout(timeout);
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1c1c1c" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-5 px-6"
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={greetingIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="font-display text-3xl sm:text-4xl"
            style={{ color: "#c6a769" }}
          >
            {GREETINGS[greetingIdx].text}
          </motion.p>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="font-body text-lg sm:text-xl font-medium text-white/90 tracking-wide"
        >
          {companyName || "Oasis B2B Partner"}
        </motion.p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.8, ease: "easeInOut" }}
          className="h-[1px] w-24 mx-auto origin-left"
          style={{ backgroundColor: "#c6a769" }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="font-body text-[10px] tracking-[0.25em] uppercase text-white/40"
        >
          {ready ? "Premium B2B Portal" : "Loading your dashboard…"}
        </motion.p>
      </motion.div>
    </div>
  );
};

export default WelcomeGate;
