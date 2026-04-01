import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import BestSellers from "@/components/home/BestSellers";
import HomeFooter from "@/components/home/HomeFooter";
import AnnouncementStrip from "@/components/home/AnnouncementStrip";
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
import { Shield, Globe, Truck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

const TRUST = [
  { icon: Shield, label: "Premium Ingredients" },
  { icon: Globe, label: "Export Ready" },
  { icon: Truck, label: "Pan India Supply" },
];

const Index = () => {
  const navigate = useNavigate();
  const { items: cartItems } = useCart();

  const cartCount = cartItems?.length || 0;
  const cartTarget = 9;
  const cartProgress = Math.min((cartCount / cartTarget) * 100, 100);
  const cartRemaining = Math.max(cartTarget - cartCount, 0);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">

        {/* ─── ANNOUNCEMENT STRIP ─── */}
        <AnnouncementStrip />

        {/* ─── HERO ─── */}
        <motion.section {...fade()} className="relative w-full" style={{ height: "38vh", minHeight: 260 }}>
          <img src={heroImage} alt="Premium Baklawa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-foreground/5 to-transparent" />
          <div className="absolute bottom-8 left-6 right-6 z-10">
            <div className="w-7 h-[1px] bg-primary/60 mb-2.5" />
            <p className="font-body text-[9px] font-light tracking-[0.35em] uppercase text-white/60 mb-1.5">
              Oasis Baklawa
            </p>
            <h1 className="font-display text-[26px] leading-[1.1] text-white mb-1">
              Authentic Arabic<br />Sweets
            </h1>
            <p className="font-body text-[11px] text-white/60 mb-5 tracking-wider">
              Crafted for Global Trade
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="border border-primary/70 text-white font-body text-[11px] font-medium px-6 py-2 rounded-full transition-all duration-300 hover:bg-primary/20 backdrop-blur-sm"
              style={{ background: "rgba(198,168,125,0.12)" }}
            >
              Explore Catalogue
            </motion.button>
          </div>
        </motion.section>

        {/* ─── CURATED COLLECTIONS ─── */}
        <motion.div {...fade(0.06)}>
          <CuratedCollections />
        </motion.div>

        <SectionDivider />

        {/* ─── CATEGORIES ─── */}
        <motion.section {...fade(0.08)} className="px-5 mb-8">
          <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Shop by Category
          </p>
          <div className="grid grid-cols-2 gap-3">
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
                <span className="absolute bottom-3 left-3 font-display text-[11px] font-medium text-white tracking-wider">
                  {cat.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <SectionDivider />

        {/* ─── ORDER AGAIN ─── */}
        <motion.div {...fade(0.12)} className="mb-8">
          <SmartReorderSection />
        </motion.div>

        {/* ─── NEW ARRIVALS ─── */}
        <motion.div {...fade(0.14)}>
          <NewArrivals />
        </motion.div>

        <SectionDivider />

        {/* ─── COMPLETE YOUR CART ─── */}
        {cartItems && cartCount > 0 && (
          <motion.section {...fade(0.16)} className="mx-5 rounded-2xl bg-card border border-primary/10 px-5 py-5 mb-8">
            <p className="font-display text-base text-foreground mb-1">Complete Your Cart</p>
            <p className="font-body text-[10px] text-muted-foreground mb-3 tracking-wide">
              {cartCount}/{cartTarget} items · Add {cartRemaining} more to optimise your order
            </p>
            <Progress value={cartProgress} className="h-[3px] mb-4 bg-muted [&>div]:bg-primary" />
            <ProductSection tagKey="recommended" variant="compact" />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="mt-4 w-full py-2 rounded-full border border-primary/30 text-primary font-body text-[10px] font-medium tracking-wider hover:bg-primary/5 transition-colors duration-200"
            >
              Complete Cart
            </motion.button>
          </motion.section>
        )}

        {/* ─── BEST SELLERS ─── */}
        <motion.section {...fade(0.2)} className="px-5 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-[0.5px] bg-primary/40" />
            <h2 className="font-display text-xl text-foreground">Best Sellers</h2>
          </div>
          <BestSellers />
        </motion.section>

        <SectionDivider />

        {/* ─── SMART RECOMMENDATIONS ─── */}
        <motion.div {...fade(0.22)}>
          <SmartRecommendations />
        </motion.div>

        {/* ─── GIFTING STORY BLOCK ─── */}
        <motion.div {...fade(0.24)}>
          <GiftingStoryBlock />
        </motion.div>

        <SectionDivider />

        {/* ─── BRAND STORY STRIP ─── */}
        <motion.section {...fade(0.26)} className="mx-5 rounded-2xl bg-card border border-primary/8 px-5 py-8 mb-6">
          <p className="font-display text-base text-foreground text-center mb-6">
            Crafted for Excellence
          </p>
          <div className="flex items-start justify-around">
            {TRUST.map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2.5 max-w-[85px]">
                <div className="w-9 h-9 rounded-full border border-primary/15 flex items-center justify-center">
                  <t.icon size={15} className="text-primary" strokeWidth={1.5} />
                </div>
                <span className="font-body text-[8px] text-muted-foreground text-center leading-tight tracking-[0.15em] uppercase">{t.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ─── FOOTER ─── */}
        <HomeFooter />

        {/* Bottom nav clearance */}
        <div className="h-20" />
      </div>
    </AppShell>
  );
};

export default Index;
