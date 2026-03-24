import TopNavBar from "@/components/TopNavBar";
import { useState } from "react";
import { ArrowRight, ChevronLeft, Star, TrendingUp, Package, Gift, ShoppingCart, Box } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";

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

  return (
    <AppShell>
      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-24">
        {/* Universal Back Button (Top Left) */}
        <div className="fixed top-20 left-4 z-40 lg:hidden">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-[#C5A059] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <main className="pt-24 px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          {/* HELLO GRAPHIC SIMULATION */}
          <div className="text-center mb-8">
            <h1 className="text-6xl md:text-8xl font-serif text-gray-900 tracking-tighter mb-4">Hello</h1>
            <p className="text-sm md:text-base font-medium text-gray-800 tracking-wide">
              नमस्ते, सति स्री अकाल, السَّلَامُ عَلَيْكُمْ, வணக்கம்,
              <br className="hidden md:block" />
              নমস্কার, કેમ છો, నమస్కారం, खाम माणी, Chibai.........
            </p>
          </div>

          {/* 1. SEASON'S SPECIAL HERO (Auto-swiping container) */}
          <div className="relative rounded-3xl overflow-hidden shadow-xl bg-gradient-to-r from-[#1A1A1A] to-[#2D2D2D] flex snap-x snap-mandatory overflow-x-auto scrollbar-hide">
            <div className="min-w-full snap-center relative p-8 md:p-12 flex flex-col items-start w-2/3">
              <p className="text-[#C5A059] text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <Star size={12} fill="currentColor" /> Limited Edition
              </p>
              <h2 className="text-3xl md:text-5xl font-serif text-white leading-tight mb-6">
                Festive Special
                <br />
                Gifting Collection
              </h2>
              <button className="px-8 py-3 bg-[#C5A059] text-white rounded-full text-sm font-bold hover:bg-[#B38F48] transition-colors shadow-lg">
                Explore Collection
              </button>
              <div className="absolute top-0 right-0 w-1/2 h-full bg-[url('https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80')] bg-cover bg-left opacity-40 mix-blend-overlay mask-image-gradient"></div>
            </div>
            {/* Pagination Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <div className="w-2 h-2 rounded-full bg-[#C5A059]"></div>
              <div className="w-2 h-2 rounded-full bg-white/30"></div>
              <div className="w-2 h-2 rounded-full bg-white/30"></div>
            </div>
          </div>

          {/* 2. SMART REORDER */}
          <section>
            <h2 className="text-xl font-serif text-gray-900 flex items-center gap-2 mb-1">
              <span className="text-[#C5A059]">⚡</span> Smart Reorder
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Based on your frequent orders</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
              {SMART_REORDER.map((item) => (
                <div
                  key={item.id}
                  className="min-w-[220px] bg-white border border-gray-100 rounded-2xl p-4 snap-start shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="h-32 mb-4 rounded-xl overflow-hidden bg-gray-50">
                    <img src={item.image} className="w-full h-full object-cover mix-blend-multiply" alt={item.name} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-3">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900">
                      ₹{item.price.toLocaleString("en-IN")} <span className="text-gray-400 text-[10px]">/ kg</span>
                    </p>
                    <button className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-[#C5A059] transition-colors">
                      <ShoppingCart size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. PREPACKED / PRIVATE LABEL (Hero Product) */}
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#C5A059]/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[#C5A059]/10 to-transparent"></div>
            <h2 className="text-2xl font-serif text-gray-900 mb-2 relative z-10">Private Label & Retail Ready</h2>
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
                    <span className="text-[9px] font-bold bg-[#C5A059] text-white px-2 py-0.5 rounded uppercase tracking-wider">
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

          {/* 4. SMALL CATEGORY CARDS (2x3 Grid) */}
          <section>
            <h2 className="text-xl font-serif text-gray-900 mb-6">Wholesale Categories</h2>
            <div className="grid grid-cols-3 gap-3">
              {["Baklawa", "Dates", "Chocolates", "Fusion Sweets", "Seasoned Nuts", "Dragees"].map((cat) => (
                <div
                  key={cat}
                  onClick={() => navigate("/catalogue")}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 aspect-square flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#C5A059] hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:bg-[#C5A059]/10 transition-colors">
                    <Box size={20} className="text-[#C5A059]" />
                  </div>
                  <span className="font-serif text-gray-800 text-xs md:text-sm font-medium leading-tight">{cat}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. RECOMMENDED FOR YOU */}
          <section>
            <h2 className="text-xl font-serif text-gray-900 flex items-center gap-2 mb-1">
              <TrendingUp className="text-[#C5A059]" size={20} /> Recommended for You
            </h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Based on your business profile</p>
            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
              {RECOMMENDED.map((item) => (
                <div
                  key={item.id}
                  className="min-w-[240px] bg-white border border-gray-100 rounded-2xl p-4 snap-start shadow-sm hover:shadow-md transition-shadow"
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
                    <button className="px-4 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold hover:bg-[#C5A059] hover:text-white transition-colors">
                      Quick Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6. EMPTY PACKAGING SOLUTIONS */}
          <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl mb-8">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.8)_0,transparent_60%)]"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-serif text-white mb-2 flex items-center gap-3">
                <Gift className="text-[#C5A059]" /> Packaging Solutions
              </h2>
              <p className="text-sm text-gray-400 mb-8 font-medium">
                Perfect for wrapping your own products. Premium rigid boxes, trays, and jars.
              </p>

              <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-2">
                {PACKAGING.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-[200px] flex gap-3 items-center bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-sm"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                      <img src={item.image} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xs mb-1">{item.name}</h3>
                      <p className="text-[10px] text-[#C5A059] uppercase tracking-wider font-bold">{item.type}</p>
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
