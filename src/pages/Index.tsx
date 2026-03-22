import AppShell from "@/components/AppShell";
import AIOrderUpload from "@/components/home/AIOrderUpload";
import SmartReorder from "@/components/home/SmartReorder";
import BestSellers from "@/components/home/BestSellers";
import PromoBanner from "@/components/home/PromoBanner";
import { Grid, Gift, Sparkles, TrendingUp, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-10 max-w-3xl mx-auto pb-24">
        {/* 1. Greeting & Top Banner (Luxury Campaign) */}
        <div className="space-y-4">
          <div className="pt-2">
            <p className="font-body text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Welcome back,
            </p>
            <h1 className="font-display text-3xl md:text-4xl tracking-wide text-foreground mt-1 font-bold">
              Oasis Baklawa
            </h1>
          </div>
          <PromoBanner />
        </div>

        {/* 2. AI Order Fetching */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Sparkles size={18} className="text-amber-500" /> Smart Ordering
          </h2>
          <AIOrderUpload />
        </div>

        {/* 3. Horizontal Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Grid size={18} className="text-primary" /> Browse Categories
            </h2>
            <button
              onClick={() => navigate("/catalog")}
              className="text-sm font-semibold text-primary hover:underline flex items-center"
            >
              View All <ChevronRight size={16} />
            </button>
          </div>

          {/* Horizontal Scrollable Category Pills */}
          <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
            {["Premium Baklawa", "Assorted Hampers", "Chocolates", "Traditional Laddu", "Bakery"].map((cat) => (
              <button
                key={cat}
                onClick={() => navigate("/catalog")}
                className="whitespace-nowrap px-5 py-3 rounded-xl bg-muted/40 border border-border text-sm font-bold text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Best Sellers & Recommended */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <TrendingUp size={18} className="text-emerald-500" /> Bestsellers & Recommended
          </h2>
          <BestSellers />
        </div>

        {/* 5. Smart Reorder (Past Orders) */}
        <div className="space-y-3">
          <SmartReorder />
        </div>

        {/* 6. New Launches (Placeholder UI for future component) */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">New Launches</h2>
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 w-2/3">
              <span className="bg-amber-500 text-black text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-sm mb-2 inline-block">
                Just Dropped
              </span>
              <h3 className="text-xl font-display font-bold mb-1">Pistachio Fusion Tart</h3>
              <p className="text-slate-300 text-xs mb-4">
                Experience the new blend of traditional Turkish pastry and modern tart.
              </p>
              <button
                onClick={() => navigate("/catalog")}
                className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-100 transition-colors"
              >
                Explore Now
              </button>
            </div>
            {/* Decorative background element */}
            <div className="absolute -right-10 -bottom-10 opacity-20">
              <Sparkles size={120} />
            </div>
          </div>
        </div>

        {/* 7. Seasonal Gifting (Placeholder UI) */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Gift size={18} className="text-rose-500" /> Seasonal Gifting
          </h2>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-display font-bold text-rose-950 mb-1">Corporate Diwali Hampers</h3>
              <p className="text-rose-800 text-xs mb-4 max-w-[70%]">
                Pre-book bulk festive hampers for your corporate clients. Custom branding available.
              </p>
              <button
                onClick={() => navigate("/catalog")}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-rose-700 transition-colors"
              >
                View Hampers
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Index;
