import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import BestSellers from "@/components/home/BestSellers";
import HomeFooter from "@/components/home/HomeFooter";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import heroImage from "@/assets/hero-luxury.jpg";
import giftingBanner from "@/assets/gifting-banner.jpg";
import { Shield, Globe, Truck } from "lucide-react";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
});

const CATEGORIES = [
  { label: "Bulk Sweets & Nuts", image: "🍬", query: "Bulk Sweets & Nuts" },
  { label: "Ready Packs", image: "📦", query: "Ready packs" },
  { label: "Premium Gift Packs", image: "🎁", query: "Premium Gift Packs" },
  { label: "Frozen Range", image: "❄️", query: "Semi-Prepared & Frozen Range" },
];

const TRUST = [
  { icon: Shield, label: "Premium Ingredients" },
  { icon: Globe, label: "Export Ready" },
  { icon: Truck, label: "Pan India Supply" },
];

const Index = () => {
  const navigate = useNavigate();
  const { cartItems } = useCart();

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-28">

        {/* ─── HERO ─── */}
        <motion.section {...fade()} className="relative w-full" style={{ height: "40vh", minHeight: 280 }}>
          <img src={heroImage} alt="Premium Baklawa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
          <div className="absolute bottom-8 left-6 right-6 z-10">
            <p className="font-body text-[11px] font-light tracking-[0.25em] uppercase text-foreground/60 mb-1">
              Oasis Baklawa
            </p>
            <h1 className="font-display text-3xl text-foreground leading-tight mb-1">
              Authentic Arabic Sweets
            </h1>
            <p className="font-body text-xs text-muted-foreground mb-4">
              Crafted for Global Trade
            </p>
            <button
              onClick={() => navigate("/catalogue")}
              className="bg-foreground text-primary-foreground font-body text-sm font-medium px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              Explore Catalogue
            </button>
          </div>
        </motion.section>

        {/* ─── CATEGORY GRID ─── */}
        <motion.section {...fade(0.15)} className="px-5 mt-8 mb-10">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => navigate(`/catalogue?category=${encodeURIComponent(cat.query)}`)}
                className="relative aspect-[4/3] rounded-xl overflow-hidden group"
              >
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <span className="text-5xl group-hover:scale-110 transition-transform duration-500">{cat.image}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <span className="absolute bottom-3 left-3 font-body text-xs font-medium text-white tracking-wide">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ─── ORDER AGAIN ─── */}
        <motion.div {...fade(0.2)} className="mb-10">
          <SmartReorderSection />
        </motion.div>

        {/* ─── COMPLETE YOUR CART ─── */}
        {cartItems && cartItems.length > 0 && (
          <motion.section {...fade(0.25)} className="bg-secondary mx-5 rounded-xl px-5 py-5 mb-10">
            <p className="font-body text-sm text-foreground font-medium mb-1">Complete Your Cart</p>
            <p className="font-body text-xs text-muted-foreground mb-4">
              You have {cartItems.length} items. Add more to optimise your order.
            </p>
            <ProductSection tagKey="recommended" variant="compact" />
          </motion.section>
        )}

        {/* ─── BEST SELLERS ─── */}
        <motion.section {...fade(0.3)} className="px-5 mb-10">
          <h2 className="font-display text-2xl text-foreground mb-5">Best Sellers</h2>
          <BestSellers />
        </motion.section>

        {/* ─── GIFTING BANNER ─── */}
        <motion.section {...fade(0.35)} className="relative mx-5 rounded-xl overflow-hidden mb-10" style={{ height: 120 }}>
          <img src={giftingBanner} alt="Gifting" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-foreground/40 flex flex-col items-center justify-center">
            <p className="font-display text-xl text-white">Designed for Gifting</p>
            <p className="font-body text-xs text-white/70 mt-1">Crafted for Impression</p>
          </div>
        </motion.section>

        {/* ─── TRUST STRIP ─── */}
        <motion.section {...fade(0.4)} className="flex items-center justify-around px-5 py-6 mb-8">
          {TRUST.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-2">
              <t.icon size={20} className="text-primary" strokeWidth={1.5} />
              <span className="font-body text-[10px] text-muted-foreground text-center tracking-wide">{t.label}</span>
            </div>
          ))}
        </motion.section>

        {/* ─── FOOTER ─── */}
        <HomeFooter />
      </div>
    </AppShell>
  );
};

export default Index;
