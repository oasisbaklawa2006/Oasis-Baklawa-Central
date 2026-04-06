import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TutorialStep {
  title: string;
  description: string;
  highlight: string;
  imagePlaceholder: string;
}

const CUSTOMER_STEPS: TutorialStep[] = [
  {
    title: "Place Your Order",
    description: "Browse the catalogue and add items to cart. Our AI assistant can also parse your order sheets instantly.",
    highlight: "Order Now",
    imagePlaceholder: "📦",
  },
  {
    title: "Wallet & Payments",
    description: "View your wallet balance, request credit lines, and track payment history — all in one place.",
    highlight: "Wallet",
    imagePlaceholder: "💰",
  },
  {
    title: "Track Shipping",
    description: "Monitor your dispatch status in real-time with LR numbers and transporter details.",
    highlight: "Track Shipping",
    imagePlaceholder: "🚚",
  },
];

const EMPLOYEE_STEPS: TutorialStep[] = [
  {
    title: "Your Task Queue",
    description: "All pending production, packing, and dispatch tasks assigned to you appear here. Stay on top of your workflow.",
    highlight: "Task Queue",
    imagePlaceholder: "📋",
  },
  {
    title: "CMD Heartbeat",
    description: "The executive cockpit showing real-time KPIs, sales performance, and critical alerts across all departments.",
    highlight: "CMD Heartbeat",
    imagePlaceholder: "💓",
  },
  {
    title: "Audit Trail",
    description: "Every action is logged. Review changes, track security events, and maintain full compliance transparency.",
    highlight: "Audit Logs",
    imagePlaceholder: "🛡️",
  },
];

const OnboardingOverlay = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("users")
        .select("role, has_seen_tutorial")
        .eq("id", user.id)
        .maybeSingle();
      if (data && data.has_seen_tutorial === false) {
        setRole(data.role);
        setVisible(true);
      }
    };
    check();
  }, [user]);

  const isEmployee = role && !["customer_user", "buyer", "b2b_buyer", "special_buyer", "horeca_buyer", "wholesale_buyer", "bulk_buyer", "client"].includes(role);
  const steps = isEmployee ? EMPLOYEE_STEPS : CUSTOMER_STEPS;
  const isLast = step === steps.length - 1;

  const handleComplete = async () => {
    if (!user) return;
    await supabase
      .from("users")
      .update({ has_seen_tutorial: true } as Record<string, unknown>)
      .eq("id", user.id);
    setVisible(false);
  };

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleComplete}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#141414", border: "1px solid rgba(196,160,82,0.2)" }}
      >
        {/* Close */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <X size={14} />
        </button>

        {/* Step indicator */}
        <div className="px-6 pt-6 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500 flex-1"
              style={{
                backgroundColor: i <= step ? "#C4A052" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="p-6 space-y-5"
          >
            {/* Image placeholder */}
            <div
              className="w-full h-40 rounded-xl flex items-center justify-center text-5xl"
              style={{ backgroundColor: "rgba(196,160,82,0.08)", border: "1px solid rgba(196,160,82,0.15)" }}
            >
              {steps[step].imagePlaceholder}
            </div>

            {/* Highlight chip */}
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] tracking-[0.2em] uppercase font-ui font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: "rgba(196,160,82,0.15)", color: "#C4A052" }}
              >
                {steps[step].highlight}
              </span>
            </div>

            <h3 className="font-display text-xl font-semibold" style={{ color: "#ffffff" }}>
              {steps[step].title}
            </h3>
            <p className="text-sm leading-relaxed font-body" style={{ color: "#9a9a9a" }}>
              {steps[step].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 text-xs font-ui font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleNext}
            className="h-9 px-5 rounded-full flex items-center gap-2 text-xs font-ui font-semibold transition-all"
            style={{
              background: isLast
                ? "linear-gradient(135deg, #C4A052, #D4B56A)"
                : "rgba(196,160,82,0.15)",
              color: isLast ? "#0a0a0a" : "#C4A052",
            }}
          >
            {isLast ? (
              <>
                Got it! <Check size={14} />
              </>
            ) : (
              <>
                Next <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingOverlay;
