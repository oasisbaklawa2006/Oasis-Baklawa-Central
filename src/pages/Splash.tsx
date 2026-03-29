import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo-open.png";
import { supabase } from "@/integrations/supabase/client";

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      if (!session) {
        navigate("/intro", { replace: true });
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      const normalizedRole = data?.role?.toUpperCase();
      if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN" || normalizedRole === "FINANCE_HEAD" || normalizedRole === "DISPATCH_HEAD" || normalizedRole === "PRODUCTION_MANAGER") {
        navigate("/admin", { replace: true });
      } else if (normalizedRole === "SALES_EXECUTIVE") {
        navigate("/sales/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1c1c1c" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center space-y-6"
      >
        <motion.img
          src={logoImg}
          alt="Oasis Baklawa"
          className="w-[145px] sm:w-[190px] md:w-[220px] mx-auto object-contain"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="font-body text-xs tracking-[0.3em] uppercase"
          style={{ color: "#c6a769" }}
        >
          Premium B2B Portal
        </motion.p>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.2, duration: 1, ease: "easeInOut" }}
          className="h-[1px] w-32 mx-auto origin-left"
          style={{ backgroundColor: "#c6a769" }}
        />
      </motion.div>
    </div>
  );
};

export default Splash;
