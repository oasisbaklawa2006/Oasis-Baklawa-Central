import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, ShoppingCart, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";

const Onboarding = () => {
  const navigate = useNavigate();
  const [showStarter, setShowStarter] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-3">
          <h1 className="font-display text-3xl tracking-wide text-foreground">
            Welcome to Oasis Baklawa B2B.
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Let us personalize your experience.
          </p>
        </div>

        {!showStarter ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <p className="font-body text-sm text-foreground text-center font-semibold">
              Do you already sell Baklawa or related Arabic sweets?
            </p>

            <button
              onClick={() => navigate("/")}
              className="w-full bg-card rounded-2xl shadow-card p-6 text-left hover:border-primary/50 border-2 border-transparent transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={24} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-body font-bold text-foreground text-sm">Yes, I am an experienced seller</p>
                  <p className="font-fine text-[11px] text-muted-foreground mt-1">Take me to the full catalogue</p>
                </div>
                <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>

            <button
              onClick={() => setShowStarter(true)}
              className="w-full bg-card rounded-2xl shadow-card p-6 text-left hover:border-primary/50 border-2 border-transparent transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={24} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-body font-bold text-foreground text-sm">No, this is my first time</p>
                  <p className="font-fine text-[11px] text-muted-foreground mt-1">Show me a curated starter menu</p>
                </div>
                <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="flex h-40 overflow-hidden">
                <img src={pistachioImg} alt="Pistachio Baklawa" className="w-1/3 object-cover" />
                <img src={cashewImg} alt="Cashew Baklawa" className="w-1/3 object-cover" />
                <img src={walnutImg} alt="Walnut Baklawa" className="w-1/3 object-cover" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <h2 className="font-display text-lg tracking-wide text-foreground">Beginner Starter Menu</h2>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <p className="font-body font-bold text-foreground text-sm">Oasis Starter Sampler Carton</p>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">
                    Perfectly packed for Category C. Includes 3× Pistachio, 3× Cashew, 3× Chocolate Assiyah.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <p className="font-fine text-[11px] text-primary font-semibold">9 Packs · 1 Complete Carton</p>
                    <p className="font-body text-sm font-bold text-foreground">₹11,199</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/cart")}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
                >
                  <ShoppingCart size={16} />
                  Add Kit & Continue
                </button>
              </div>
            </div>

            <button
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-xl bg-card border border-border text-foreground font-body text-sm font-medium hover:border-primary/50 transition-colors"
            >
              Skip — Browse Full Catalogue
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Onboarding;
