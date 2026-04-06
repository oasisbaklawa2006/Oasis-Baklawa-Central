import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const GREETINGS = [
  { lang: "English", text: "Welcome" },
  { lang: "Hindi", text: "स्वागत है" },
  { lang: "Arabic", text: "أهلاً وسهلاً" },
];

const WelcomeGate = () => {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [greetingIdx, setGreetingIdx] = useState(0);

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

  // Cycle greetings
  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingIdx((prev) => (prev + 1) % GREETINGS.length);
    }, 700);
    return () => clearInterval(interval);
  }, []);

  // Auto-navigate after 2.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/home", { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#1c1c1c" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-5 px-6"
      >
        {/* Cycling greeting */}
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

        {/* Company name */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="font-body text-lg sm:text-xl font-medium text-white/90 tracking-wide"
        >
          {companyName || "Oasis B2B Partner"}
        </motion.p>

        {/* Divider */}
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
          Premium B2B Portal
        </motion.p>
      </motion.div>
    </div>
  );
};

export default WelcomeGate;
