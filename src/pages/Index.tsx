import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import BestSellers from "@/components/home/BestSellers";
import HomeFooter from "@/components/home/HomeFooter";
import { useCart } from "@/hooks/useCart";
import heroImage from "@/assets/hero-luxury.jpg";
import { Shield, Globe, Truck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: EASE },
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
  const { items: cartItems } = useCart();

  const cartCount = cartItems?.length || 0;
  const cartTarget = 9;
  const cartProgress = Math.min((cartCount / cartTarget) * 100, 100);
  const cartRemaining = Math.max(cartTarget - cartCount, 0);

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-28">

        {/* ─── HERO ─── */}
        <motion.section {...fade()} className="relative w-full" style={{ height: "42vh", minHeight: 300 }}>
          <img src={heroImage} alt="Premium Baklawa" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
          <div className="absolute bottom-10 left-7 right-7 z-10">
            <p className="font-body text-[10px] font-light tracking-[0.3em] uppercase text-primary-foreground/70 mb-2">
              Oasis Baklawa
            </p>
            <h1 className="font-display text-[32px] leading-[1.1] text-white mb-1.5">
              Authentic Arabic<br />Sweets
            </h1>
            <p className="font-body text-[13px] text-white/70 mb-6 tracking-wide">
              Crafted for Global Trade
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="bg-primary text-primary-foreground font-body text-sm font-medium px-8 py-3 rounded-full shadow-soft-lg transition-all duration-300"
            >
              Explore Catalogue
            </motion.button>
          </div>
        </motion.section>

        {/* ─── CATEGORIES ─── */}
        <motion.section {...fade(0.1)} className="px-6 mt-10 mb-12">
          <p className="font-body text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground mb-5">
            Shop by Category
          </p>
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat.label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/catalogue?category=${encodeURIComponent(cat.query)}`)}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden group"
              >
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <span className="text-5xl group-hover:scale-110 transition-transform duration-700 ease-out">{cat.image}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent" />
                <span className="absolute bottom-4 left-4 font-serif text-[13px] font-medium text-white tracking-wide">
                  {cat.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* ─── ORDER AGAIN ─── */}
        <motion.div {...fade(0.15)} className="mb-12">
          <SmartReorderSection />
        </motion.div>

        {/* ─── COMPLETE YOUR CART ─── */}
        {cartItems && cartCount > 0 && (
          <motion.section {...fade(0.2)} className="mx-6 rounded-2xl bg-card shadow-soft px-6 py-6 mb-12">
            <p className="font-display text-lg text-foreground mb-1">Complete Your Cart</p>
            <p className="font-body text-xs text-muted-foreground mb-4">
              {cartCount}/{cartTarget} items · Add {cartRemaining} more to optimise your order
            </p>
            <Progress value={cartProgress} className="h-1.5 mb-5 bg-muted [&>div]:bg-secondary" />
            <ProductSection tagKey="recommended" variant="compact" />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/catalogue")}
              className="mt-4 w-full py-2.5 rounded-full border border-secondary/40 text-secondary font-body text-xs font-medium tracking-wide hover:bg-secondary/5 transition-colors duration-200"
            >
              Complete Cart
            </motion.button>
          </motion.section>
        )}

        {/* ─── BEST SELLERS ─── */}
        <motion.section {...fade(0.25)} className="px-6 mb-12">
          <h2 className="font-display text-2xl text-foreground mb-6">Best Sellers</h2>
          <BestSellers />
        </motion.section>

        {/* ─── BRAND STORY STRIP ─── */}
        <motion.section {...fade(0.3)} className="mx-6 rounded-2xl bg-card shadow-soft px-6 py-8 mb-12">
          <p className="font-display text-xl text-foreground text-center mb-6">
            Crafted for Excellence
          </p>
          <div className="flex items-start justify-around">
            {TRUST.map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-3 max-w-[90px]">
                <div className="w-11 h-11 rounded-full bg-secondary/10 flex items-center justify-center">
                  <t.icon size={18} className="text-secondary" strokeWidth={1.5} />
                </div>
                <span className="font-body text-[10px] text-muted-foreground text-center leading-tight tracking-wide">{t.label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ─── FOOTER ─── */}
        <HomeFooter />
      </div>
    </AppShell>
  );
};

export default Index;
