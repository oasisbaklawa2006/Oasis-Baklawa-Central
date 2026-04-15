import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import BestSellers from "@/components/home/BestSellers";
import GrowthIntelligenceButton from "@/components/growth/GrowthIntelligenceButton";
import HomeFooter from "@/components/home/HomeFooter";
import CuratedCollections from "@/components/home/CuratedCollections";
import NewArrivals from "@/components/home/NewArrivals";
import GiftingStoryBlock from "@/components/home/GiftingStoryBlock";
import SmartRecommendations from "@/components/home/SmartRecommendations";
import SectionDivider from "@/components/home/SectionDivider";
import { useCart } from "@/hooks/useCart";
import heroImage from "@/assets/hero-luxury.jpg";
import catBulk from "@/assets/cat-bulk-sweets.jpg";
import catReady from "@/assets/cat-ready-packs.jpg";
import catGift from "@/assets/cat-gift-packs.jpg";
import catFrozen from "@/assets/cat-frozen.jpg";
import { Shield, Globe, Truck, Gift, Tag } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

const CATEGORIES = [
  { label: "Bulk Sweets & Nuts", image: catBulk, query: "Bulk Sweets & Nuts" },
  { label: "Ready Packs", image: catReady, query: "Ready packs" },
  { label: "Premium Gift Packs", image: catGift, query: "Premium Gift Packs" },
  { label: "Frozen Range", image: catFrozen, query: "Semi-Prepared & Frozen Range" },
];

const TRADE_STRENGTHS = [
  { icon: Shield, label: "Premium Ingredients" },
  { icon: Globe, label: "Export Ready" },
  { icon: Truck, label: "Pan India Supply" },
  { icon: Tag, label: "Private Labelling" },
  { icon: Gift, label: "Corporate Gifting" },
];

const TRUST = [
  { icon: Shield, label: "Premium Ingredients" },
  { icon: Globe, label: "Export Ready" },
  { icon: Truck, label: "Pan India Supply" },
];

const Index = () => {
  const navigate = useNavigate();
  const { items: cartItems } = useCart();
  const { user, priceTier, refreshPriceTier } = useAuth();

  const cartCount = cartItems?.length || 0;
  const cartTarget = 9;
  const cartProgress = Math.min((cartCount / cartTarget) * 100, 100);
  const cartRemaining = Math.max(cartTarget - cartCount, 0);

  useEffect(() => {
    if (!user) return;
    void refreshPriceTier();
  }, [refreshPriceTier, user?.id]);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">

        {/* ─── 1. HERO BANNER ─── */}
        <motion.section {...fade()} className="relative w-full" style={{ height: "36vh", minHeight: 240 }}>
          <img src={heroImage} alt="Premium Baklawa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
          <div className="absolute bottom-6 left-5 right-5 z-10">
            <div className="w-7 h-[1px] bg-primary/60 mb-2" />
            <p className="font-body text-[9px] font-light tracking-[0.35em] uppercase text-white/60 mb-1">
              Oasis Baklawa
            </p>
            <h1 className="font-display text-[24px] leading-[1.1] text-white mb-1">
              Authentic Arabic<br />Sweets
            </h1>
            <p className="font-body text-[10px] text-white/55 mb-4 tracking-wider">
              Crafted for Global Trade
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="border border-primary/60 text-white font-body text-[10px] font-medium px-5 py-2 rounded-full transition-all duration-300 hover:bg-primary/20 backdrop-blur-sm"
              style={{ background: "rgba(198,168,125,0.15)" }}
            >
              Explore Catalogue
            </motion.button>
          </div>
        </motion.section>

        {/* ─── 2. TRADE STRENGTH STRIP ─── */}
        <motion.div {...fade(0.04)} className="py-3 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide gap-5 px-5">
            {TRADE_STRENGTHS.map((t) => (
              <div key={t.label} className="flex items-center gap-1.5 flex-shrink-0">
                <t.icon size={12} className="text-primary" strokeWidth={1.5} />
                <span className="font-body text-[8px] text-muted-foreground tracking-[0.12em] uppercase whitespace-nowrap">{t.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <SectionDivider />

        {/* ─── STARTER GUIDE HERO ─── */}
        <motion.section {...fade(0.05)} className="px-5 mb-4">
          <GrowthIntelligenceButton variant="hero" />
        </motion.section>

        <SectionDivider />
        <motion.div {...fade(0.06)}>
          <CuratedCollections />
        </motion.div>

        <SectionDivider />

        {/* ─── 4. SHOP BY CATEGORY ─── */}
        <motion.section {...fade(0.08)} className="px-5 mb-6">
          <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground mb-3">
            Shop by Category
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat.label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/catalogue?category=${encodeURIComponent(cat.query)}`)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden group"
              >
                <img
                  src={cat.image}
                  alt={cat.label}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                  width={512}
                  height={512}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent" />
                <span className="absolute bottom-2.5 left-3 font-display text-[10px] font-medium text-white tracking-wider">
                  {cat.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <SectionDivider />

        {/* ─── 5. COMPLETE YOUR CART ─── */}
        {cartItems && cartCount > 0 && (
          <motion.section {...fade(0.1)} className="mx-5 rounded-2xl bg-card border border-primary/10 px-4 py-4 mb-6">
            <p className="font-display text-[15px] text-foreground mb-0.5">Complete Your Cart</p>
            <p className="font-body text-[9px] text-muted-foreground mb-2.5 tracking-wide">
              {cartCount}/{cartTarget} items · Add {cartRemaining} more to optimise your order
            </p>
            <Progress value={cartProgress} className="h-[2px] mb-3 bg-muted [&>div]:bg-primary" />
            <ProductSection tagKey="recommended" variant="compact" priceTier={priceTier} />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="mt-3 w-full py-2 rounded-full border border-primary/30 text-primary font-body text-[9px] font-medium tracking-wider hover:bg-primary/5 transition-colors duration-200"
            >
              Complete Cart
            </motion.button>
          </motion.section>
        )}

        {/* ─── 6. ORDER AGAIN ─── */}
        <motion.div {...fade(0.12)} className="mb-6">
          <SmartReorderSection priceTier={priceTier} />
        </motion.div>

        <SectionDivider />

        {/* ─── 7. BEST SELLERS ─── */}
        <motion.section {...fade(0.14)} className="px-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-[0.5px] bg-primary/40" />
            <h2 className="font-display text-lg text-foreground">Best Sellers</h2>
          </div>
          <BestSellers priceTier={priceTier} />
        </motion.section>

        <SectionDivider />

        {/* ─── 8. NEW ARRIVALS ─── */}
        <motion.div {...fade(0.16)}>
          <NewArrivals priceTier={priceTier} />
        </motion.div>

        {/* ─── 9. RECOMMENDED FOR YOU ─── */}
        <motion.div {...fade(0.18)}>
          <SmartRecommendations priceTier={priceTier} />
        </motion.div>

        <SectionDivider />

        {/* ─── 10. GIFTING PROMO BANNER ─── */}
        <motion.div {...fade(0.2)}>
          <GiftingStoryBlock />
        </motion.div>

        {/* ─── 11. WHY OASIS / TRADE ASSURANCE ─── */}
        <motion.section {...fade(0.22)} className="mx-5 rounded-2xl bg-card border border-primary/8 px-5 py-6 mb-5">
          <p className="font-display text-[15px] text-foreground text-center mb-5">
            Crafted for Excellence
          </p>
          <div className="flex items-start justify-around">
            {TRUST.map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2 max-w-[80px]">
                <div className="w-8 h-8 rounded-full border border-primary/15 flex items-center justify-center">
                  <t.icon size={14} className="text-primary" strokeWidth={1.5} />
                </div>
                <span className="font-body text-[7px] text-muted-foreground text-center leading-tight tracking-[0.15em] uppercase">{t.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ─── FOOTER ─── */}
        <HomeFooter />

        {/* Bottom nav clearance + safe area */}
        <div className="h-24" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </AppShell>
  );
};

export default Index;
