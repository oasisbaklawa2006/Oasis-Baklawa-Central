import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";
import introBalawa from "@/assets/intro-baklawa.jpg";
import introGlobal from "@/assets/intro-global.jpg";
import introTech from "@/assets/intro-tech.jpg";

const SLIDES = [
  {
    image: introBalawa,
    title: "Legacy of Taste",
    subtitle: "Crafted with centuries of tradition",
    description: "Premium baklawa handcrafted with the finest ingredients, delivering excellence that transcends generations.",
  },
  {
    image: introGlobal,
    title: "Global B2B Excellence",
    subtitle: "Reaching every corner of the world",
    description: "From our factory floor to your doorstep — a seamless supply chain engineered for scale and precision.",
  },
  {
    image: introTech,
    title: "Technology meets Tradition",
    subtitle: "Your intelligent ERP companion",
    description: "A state-of-the-art portal blending artisan heritage with enterprise-grade order management and analytics.",
  },
];

const CompanyIntro = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const isLast = current === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      navigate("/login", { replace: true });
    } else {
      setCurrent((p) => p + 1);
    }
  };

  const goPrev = () => {
    if (current > 0) setCurrent((p) => p - 1);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <img
            src={SLIDES[current].image}
            alt={SLIDES[current].title}
            className="w-full h-full object-cover opacity-40"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-end pb-16 px-6 sm:px-12 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <p
              className="text-xs tracking-[0.35em] uppercase font-ui font-medium"
              style={{ color: "#C4A052" }}
            >
              {SLIDES[current].subtitle}
            </p>
            <h1
              className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
              style={{ color: "#ffffff" }}
            >
              {SLIDES[current].title}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed font-body" style={{ color: "#b0b0b0" }}>
              {SLIDES[current].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="transition-all duration-500"
              style={{
                width: i === current ? 28 : 8,
                height: 4,
                borderRadius: 2,
                backgroundColor: i === current ? "#C4A052" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="text-xs tracking-[0.15em] uppercase font-ui font-medium transition-colors hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Skip to Login
          </button>

          <div className="flex items-center gap-3">
            {current > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={goPrev}
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: "rgba(196,160,82,0.4)", color: "#C4A052" }}
              >
                <ChevronLeft size={18} />
              </motion.button>
            )}
            <button
              onClick={goNext}
              className="h-10 px-6 rounded-full flex items-center gap-2 text-xs tracking-[0.15em] uppercase font-ui font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #C4A052, #D4B56A)",
                color: "#0a0a0a",
              }}
            >
              {isLast ? "Get Started" : "Next"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyIntro;
