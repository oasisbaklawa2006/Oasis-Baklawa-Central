import { useState, useEffect } from "react";
import { ChevronLeft, Star, TrendingUp, ShoppingCart, Box, Gift, ChevronRight, PhoneCall } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

// --- MOCK DATA ---
const SMART_REORDER = [
  {
    id: "pyramid-baklawa",
    name: "Pyramid Baklawa",
    price: 2000,
    image: "https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: "finger-baklawa",
    name: "Finger Baklawa",
    price: 2000,
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400",
  },
];

const RECOMMENDED = [
  {
    id: "pistachio-tart",
    name: "Pistachio Tart",
    pack: "9 Retail Units",
    price: 3500,
    tag: "High Margin",
    image: "https://images.unsplash.com/photo-1605697843475-430263690d0e?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: "cashew-square",
    name: "Cashew Square",
    pack: "12 Retail Units",
    price: 2800,
    tag: "Bestseller",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=400",
  },
];

const PACKAGING = [
  {
    id: "rigid-box",
    name: "Premium Rigid Boxes",
    type: "Gold Foil / Embossed",
    image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: "tin-jar",
    name: "Airtight Tin Jars",
    type: "Food Grade / Printed",
    image: "https://images.unsplash.com/photo-1615486171448-4fb651475c74?auto=format&fit=crop&q=80&w=400",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");

  // Category Array explicitly mapped for your custom SVGs
  const categories = [
    { id: "dates", name: "Dates", iconSrc: "/icons/date-palm.svg", fallback: "🌴" },
    { id: "chocolate", name: "Chocolates", iconSrc: "/icons/cacao.svg", fallback: "🍫" },
    { id: "baklawa", name: "Baklawa", iconSrc: "/icons/baklava.svg", fallback: "🍯" },
    { id: "nuts", name: "Nuts", iconSrc: "/icons/acorn.svg", fallback: "🌰" },
    { id: "dragees", name: "Dragees", iconSrc: "/icons/chocolate-almond.svg", fallback: "🍬" },
    { id: "fusion", name: "Fusion Sweets", iconSrc: "/icons/mithai.svg", fallback: "🍡" },
  ];

  // Fetch the logged-in user's company name
  useEffect(() => {
    const fetchCompany = async () => {
      const { data } = await supabase.from("orders").select("company:companies(business_name)").limit(1);

      if (data && data[0]?.company?.business_name) {
        setCompanyName(data[0].company.business_name);
      } else {
        setCompanyName("TCF Chocolates and Gifts Pvt Ltd"); // Fallback
      }
    };
    fetchCompany();
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-24 relative">
        {/* Universal Back Button (Top Left) */}
        <div className="fixed top-20 left-4 z-40 lg:hidden">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#B8860B] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* FLOATING CALL BUTTON */}
        <button
          onClick={() => window.open("tel:+919876543210")}
          className="fixed right-4 top-24 w-12 h-12 bg-[#B8860B] rounded-full shadow-lg flex items-center justify-center text-white hover:bg-[#9A7009] transition-transform active:scale-95 z-40"
        >
          <PhoneCall size={20} />
        </button>

        <main className="pt-24 px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          {/* PERFECTLY CENTERED MULTILINGUAL HELLO */}
          <div className="flex flex-col items-center justify-center text-center mt-6 mb-12 space-y-4">
            <h1 className="font-display text-7xl md:text-8xl font-bold text-[#B8860B] tracking-tight">Hello</h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 leading-relaxed px-4 max-w-2xl">
              नमस्ते, सति श्री अकाल, السَّلَامُ عَلَيْكُمْ, வணக்கம், নমস্কার, કેમ છો, నమస్కారం, खम्मा घणी, Chibai...
            </p>
            <h2 className="font-display text-xl md:text-3xl font-bold text-[#9A7009] mt-2">{companyName}</h2>
          </div>

          {/* CUSTOM ICON CATEGORY GRID */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Browse by Category</h3>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/catalogue?category=${cat.id}`)}
                  className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-[#B8860B]/50 hover:shadow-md transition-all active:scale-95"
                >
                  {/* To use your real SVGs, upload them to public/icons/ and uncomment the img tag below */}
                  {/* <img src={cat.iconSrc} alt={cat.name} className="w-10 h-10 object-contain mb-2" /> */}

                  {/* Remove this span once your real images are uploaded */}
                  <span className="text-3xl mb-2">{cat.fallback}</span>

                  <span className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 1. SEASON'S SPECIAL HERO */}
          <div
            onClick={() => navigate("/catalogue?featured=true")}
            className="relative rounded-3xl overflow-hidden shadow-xl bg-gradient-to-r from-slate-900 to-slate-800 flex cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="min-w-full relative p-8 md:p-12 flex flex-col items-start w-2/3 z-10">
              <p className="text-[#B8860B] text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <Star size={12} fill="currentColor" /> Limited Edition
              </p>
              <h2 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight mb-6">
                Festive Special
                <br />
                Gifting Collection
              </h2>
              <button className="flex items-center gap-2 px-6 py-2.5 bg-[#B8860B] text-white rounded-xl text-sm font-bold hover:bg-[#9A7009] transition-colors shadow-lg">
                Explore Collection <ChevronRight size={16} />
              </button>
            </div>
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[url('https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80')] bg-cover bg-left opacity-30 mix-blend-overlay"></div>
          </div>

          {/* 2. SMART REORDER */}
          <section>
            <h2 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2 mb-1">
              <span className="text-[#B8860B]">⚡</span> Smart Reorder
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Based on your frequent orders</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
              {SMART_REORDER.map((item) => (
                <div
                  key={item.id}
                  className="min-w-[220px] bg-white border border-gray-100 rounded-2xl p-4 snap-start shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/catalogue`)}
                >
                  <div className="h-32 mb-4 rounded-xl overflow-hidden bg-gray-50">
                    <img src={item.image} className="w-full h-full object-cover mix-blend-multiply" alt={item.name} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-3">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900">
                      ₹{item.price.toLocaleString("en-IN")} <span className="text-gray-400 text-[10px]">/ kg</span>
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/cart");
                      }}
                      className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-[#B8860B] transition-colors"
                    >
                      <ShoppingCart size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. PREPACKED / PRIVATE LABEL (Hero Product) */}
          <section
            onClick={() => navigate("/catalogue?category=fusion")}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#B8860B]/20 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[#B8860B]/10 to-transparent"></div>
            <h2 className="text-2xl font-display font-bold text-gray-900 mb-2 relative z-10">
              Private Label & Retail Ready
            </h2>
            <p className="text-sm text-gray-500 mb-6 relative z-10">Premium branded products ready for your shelves.</p>

            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 relative z-10">
              <div className="min-w-[280px] md:min-w-[320px] flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=200"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex gap-1 mb-2">
                    <span className="text-[9px] font-bold bg-[#B8860B] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                      Retail Ready
                    </span>
                    <span className="text-[9px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                      Export
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">Royal Assorted Hamper</h3>
                  <p className="text-xs text-gray-500">Premium Tin / 750g</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium italic text-right">
              * Available for private labeling at MOQ
            </p>
          </section>

          {/* 4. RECOMMENDED FOR YOU */}
          <section>
            <h2 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2 mb-1">
              <TrendingUp className="text-[#B8860B]" size={20} /> Recommended for You
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Based on your business profile</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
              {RECOMMENDED.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate("/catalogue")}
                  className="min-w-[240px] bg-white border border-gray-100 rounded-2xl p-4 snap-start shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="h-36 mb-4 rounded-xl overflow-hidden bg-gray-50 relative">
                    <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                    <span className="absolute top-2 left-2 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{item.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-3">{item.pack}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm text-gray-900">₹{item.price.toLocaleString("en-IN")}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/cart");
                      }}
                      className="px-4 py-1.5 rounded-full bg-[#B8860B]/10 text-[#B8860B] text-xs font-bold hover:bg-[#B8860B] hover:text-white transition-colors"
                    >
                      Quick Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. EMPTY PACKAGING SOLUTIONS */}
          <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl mb-8">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(184,134,11,0.8)_0,transparent_60%)]"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                  <Gift className="text-[#B8860B]" /> Packaging Solutions
                </h2>
                <button
                  onClick={() => navigate("/catalogue")}
                  className="text-[#B8860B] text-xs font-bold hover:underline"
                >
                  View All
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-8 font-medium">
                Perfect for wrapping your own products. Premium rigid boxes, trays, and jars.
              </p>

              <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-2">
                {PACKAGING.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate("/catalogue")}
                    className="min-w-[200px] flex gap-3 items-center bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                      <img src={item.image} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xs mb-1">{item.name}</h3>
                      <p className="text-[10px] text-[#B8860B] uppercase tracking-wider font-bold">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AppShell>
  );
};

export default Index;
