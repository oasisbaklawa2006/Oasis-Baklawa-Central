import { useState, useEffect } from "react";
import { Star, TrendingUp, Gift, ChevronRight, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ProductSection from "@/components/ProductSection";
import SmartReorderSection from "@/components/home/SmartReorderSection";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";

const Index = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const CATEGORY_EMOJIS: Record<string, string> = {
    "Gifting": "🎁",
    "Bulk Sweets & Nuts": "🍬",
    "Dates": "🌴",
    "Chocolates": "🍫",
    "Baklawa": "🍯",
    "Nuts & Dragees": "🌰",
    "Ready packs": "📦",
    "Premium Gift Packs": "🎀",
    "Semi-Prepared & Frozen Range": "❄️",
    "Packaging & Decoration Material": "🎨",
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch company name
      const { data: orderData } = await supabase
        .from("orders")
        .select("company:companies(business_name)")
        .limit(1);
      if (orderData && orderData[0]?.company?.business_name) {
        setCompanyName(orderData[0].company.business_name);
      }

      // Fetch live categories from products
      const { data: catData } = await supabase
        .from("products")
        .select("category")
        .eq("is_active", true);
      if (catData) {
        const unique = [...new Set(catData.map(p => p.category).filter(Boolean))];
        setCategories(unique.map(c => ({ id: c, name: c })));
      }
    };
    fetchData();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-24 relative">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          {/* HELLO */}
          <div className="flex flex-col items-center justify-center text-center pt-4 mb-10 space-y-5">
            <h1 className="font-display text-7xl md:text-8xl font-bold text-[#B8860B] tracking-tight">{t("home.hello")}</h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 leading-relaxed px-4 max-w-lg">
              नमस्ते, सति श्री अकाल, السَّلَامُ عَلَيْكُمْ, வணக்கம், নমস্কার, કેમ છો, నమస్కారం, खम्मा घणी, Chibai...
            </p>
            {companyName && (
              <h2 className="font-display text-xl md:text-3xl font-bold text-[#9A7009] mt-2">{companyName}</h2>
            )}
          </div>

          {/* FESTIVAL CALENDAR — Tag-driven */}
          <ProductSection
            tagKey="festivals-events"
            title="Upcoming Festivals & Events"
            subtitle="Curated selections for every occasion"
          />

          {/* CATEGORY GRID — Live from DB */}
          {categories.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t("home.browseCategories")}</h3>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/catalogue?category=${cat.id}`)}
                    className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-[#B8860B]/50 hover:shadow-md transition-all active:scale-95"
                  >
                    <span className="text-3xl mb-2">{CATEGORY_EMOJIS[cat.name] || "📦"}</span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">{cat.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* FESTIVAL SPECIAL GIFTING — Tag-driven */}
          <ProductSection
            tagKey="festival-gifting"
            title="Festival Special Gifting"
            subtitle="Premium gift-ready collections"
          />

          {/* SMART REORDER — Real order history */}
          <SmartReorderSection />

          {/* PRIVATE LABEL — Tag-driven */}
          <ProductSection
            tagKey="private-label"
            title="Private Label Retail Ready"
            subtitle="Available for private labeling at MOQ"
          />

          {/* RECOMMENDED — Tag-driven */}
          <ProductSection
            tagKey="recommended"
            title="Recommended For You"
            subtitle="Hand-picked selections by our team"
          />

          {/* PACKING SOLUTIONS — Tag-driven */}
          <ProductSection
            tagKey="packing-solution"
            title="Packaging Solutions"
            subtitle="Premium packaging for every need"
          />
        </main>
      </div>
    </AppShell>
  );
};

export default Index;
