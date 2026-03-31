import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import CategoryIcons from "@/components/home/CategoryIcons";
import FestivalRow from "@/components/home/FestivalRow";
import HomeFooter from "@/components/home/HomeFooter";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import heroImage from "@/assets/hero-baklawa.png";

const Index = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const { t } = useLanguage();

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
      <div className="min-h-screen bg-[#F9F8F3] font-body pb-24 relative">

        {/* ── GOLD STRIPE DIVIDER ── */}
        <div className="w-full h-2 bg-gradient-to-r from-[#C4A052] via-[#D4C08A] to-[#C4A052]" />

        {/* ── HERO IMAGE ── */}
        <div className="relative w-full flex justify-center py-6 bg-[#F9F8F3]">
          <motion.img
            src={heroImage}
            alt="Premium Baklawa Platter"
            width={1024}
            height={1024}
            className="w-[85vw] max-w-[500px] object-contain mix-blend-multiply"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* ── GOLD STRIPE ── */}
        <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-[#C4A052] to-transparent mb-6" />

        {/* ── HELLO BLOCK ── */}
        <motion.div
          className="text-center px-4 mb-10 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className="font-body text-lg md:text-xl font-semibold text-[#4A3623] tracking-wide">
            Best Indo-Arabic Sweets
          </h2>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-[#C4A052] tracking-tight">
            {t("home.hello") || "Hello"}
          </h1>
          <p className="text-[10px] md:text-xs font-body text-[#4A3623]/50 leading-relaxed px-4 max-w-md mx-auto">
            नमस्ते, सति श्री अकाल, السَّلَامُ عَلَيْكُمْ, வணக்கம், নমস্কার, કેમ છો, నమస్కారం, खम्मा घणी, Chibai...
          </p>
          {companyName && (
            <h2 className="font-display text-lg md:text-2xl font-bold text-[#C4A052] mt-1">
              {companyName}
            </h2>
          )}
        </motion.div>

        {/* ── CONTENT SECTIONS ── */}
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Category Icons */}
          <CategoryIcons />

          {/* Festivals & Events */}
          <FestivalRow />

          {/* What's New */}
          <ProductSection
            tagKey="new-arrivals"
            title="What's New ?"
            subtitle="Latest additions to our collection"
          />

          {/* Festivals & Events Products */}
          <ProductSection
            tagKey="festivals-events"
            title="Upcoming Festivals & Events"
            subtitle="Curated selections for every occasion"
          />

          {/* Ready Packs — Gold Block */}
          <ProductSection
            tagKey="private-label"
            title="Ready Packs"
            subtitle="Premium ready-to-sell retail packs"
            variant="gold-block"
          />

          {/* Smart Reorder */}
          <SmartReorderSection />

          {/* Recommended */}
          <ProductSection
            tagKey="recommended"
            title="Recommended For You"
            subtitle="Hand-picked selections by our team"
          />

          {/* Packing Solutions */}
          <ProductSection
            tagKey="packing-solution"
            title="Packaging Solutions"
            subtitle="Premium packaging for every need"
          />

          {/* Footer */}
          <HomeFooter />
        </div>
      </div>
    </AppShell>
  );
};

export default Index;
