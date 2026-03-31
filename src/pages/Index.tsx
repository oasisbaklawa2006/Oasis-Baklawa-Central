import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import CategoryIcons from "@/components/home/CategoryIcons";
import FestivalRow from "@/components/home/FestivalRow";
import HomeFooter from "@/components/home/HomeFooter";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import heroImage from "@/assets/hero-baklawa.png";

/* ── animation presets ── */
const slowReveal = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] },
});

const stagger = {
  animate: { transition: { staggerChildren: 0.15 } },
};

const child = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ── Animated Section wrapper ── */
const RevealSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const { t } = useLanguage();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const fetchCompany = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userData } = await supabase
        .from("users")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!userData?.company_id) return;
      const { data: company } = await supabase
        .from("companies")
        .select("business_name")
        .eq("id", userData.company_id)
        .maybeSingle();
      if (company?.business_name) setCompanyName(company.business_name);
    };
    fetchCompany();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#F9F8F3] pb-28 relative overflow-hidden">

        {/* ══════ FULL-BLEED HERO ══════ */}
        <div ref={heroRef} className="relative w-full h-[75vh] overflow-hidden">
          {/* Parallax image */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ scale: heroScale, opacity: heroOpacity }}
          >
            <img
              src={heroImage}
              alt="Premium Baklawa Platter"
              className="w-[110%] max-w-none h-full object-contain mix-blend-multiply"
            />
          </motion.div>

          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#F9F8F3] to-transparent" />

          {/* Floating editorial text over hero */}
          <motion.div
            className="absolute bottom-12 left-6 right-6 z-10"
            {...slowReveal(0.4)}
          >
            <p className="font-body text-[10px] font-medium tracking-[0.35em] uppercase text-[#C4A052]">
              Since 1942 · Handcrafted Excellence
            </p>
          </motion.div>
        </div>

        {/* ══════ HELLO EDITORIAL BLOCK ══════ */}
        <motion.div
          className="relative px-6 -mt-6 mb-16"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          {/* Thin gold rule */}
          <motion.div variants={child} className="w-16 h-[1px] bg-[#C4A052] mb-8" />

          <motion.h1
            variants={child}
            className="font-display text-6xl md:text-8xl font-bold text-[#1A120B] tracking-tight leading-[0.9]"
          >
            {t("home.hello") || "Hello"}
          </motion.h1>

          <motion.p
            variants={child}
            className="mt-4 text-[9px] font-body font-light text-[#1A120B]/40 tracking-[0.15em] leading-relaxed max-w-xs"
          >
            नमस्ते · ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ · السلام عليكم · வணக்கம் · নমস্কার · નમસ્તે · నమస్కారం · खम्मा घणी
          </motion.p>

          {companyName && (
            <motion.h2
              variants={child}
              className="mt-6 font-display text-xl md:text-2xl font-semibold text-[#C4A052] tracking-wide"
            >
              {companyName}
            </motion.h2>
          )}
        </motion.div>

        {/* ══════ EXPLORE — EDITORIAL COLLAGE CATEGORIES ══════ */}
        <RevealSection className="mb-20">
          <CategoryIcons />
        </RevealSection>

        {/* ══════ FESTIVALS — CINEMATIC CARDS ══════ */}
        <RevealSection className="mb-20">
          <FestivalRow />
        </RevealSection>

        {/* ══════ WHAT'S NEW — EDITORIAL SECTION ══════ */}
        <RevealSection className="mb-20">
          <ProductSection
            tagKey="new-arrivals"
            title="What's New"
            subtitle="Latest additions to our collection"
            variant="editorial"
          />
        </RevealSection>

        {/* ══════ FESTIVALS & EVENTS PRODUCTS ══════ */}
        <RevealSection className="mb-20">
          <ProductSection
            tagKey="festivals-events"
            title="Festivals & Events"
            subtitle="Curated selections for every occasion"
            variant="editorial"
          />
        </RevealSection>

        {/* ══════ READY PACKS — FULL BLEED GOLD ══════ */}
        <RevealSection className="mb-20">
          <ProductSection
            tagKey="private-label"
            title="Ready Packs"
            subtitle="Premium ready-to-sell retail packs"
            variant="gold-block"
          />
        </RevealSection>

        {/* ══════ SMART REORDER ══════ */}
        <RevealSection className="mb-20">
          <SmartReorderSection />
        </RevealSection>

        {/* ══════ RECOMMENDED ══════ */}
        <RevealSection className="mb-20">
          <ProductSection
            tagKey="recommended"
            title="Recommended"
            subtitle="Hand-picked selections by our team"
            variant="editorial"
          />
        </RevealSection>

        {/* ══════ PACKING SOLUTIONS ══════ */}
        <RevealSection className="mb-16">
          <ProductSection
            tagKey="packing-solution"
            title="Packaging"
            subtitle="Premium packaging for every need"
            variant="editorial"
          />
        </RevealSection>

        {/* ══════ FOOTER ══════ */}
        <RevealSection>
          <HomeFooter />
        </RevealSection>
      </div>
    </AppShell>
  );
};

export default Index;
