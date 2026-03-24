import TopNavBar from "@/components/TopNavBar";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Star,
  Clock,
  ArrowRight,
  ShoppingCart,
  TrendingUp,
  Sparkles,
  PackageSearch,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// --- MOCK DATA (Replace with your Supabase fetches later) ---
const CATEGORIES = ["All SKUs", "Premium Baklawa", "Corporate Hampers", "Stuffed Dates", "Mamoul", "Bulk Ingredients"];

const SMART_REORDER = [
  {
    id: 1,
    name: "Pistachio Pyramid Baklawa",
    sku: "BAK-PYR-01",
    price: 4500,
    cartonSize: "9 Retail Units",
    image: "https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: 2,
    name: "Cashew Square Baklawa",
    sku: "BAK-SQR-02",
    price: 3800,
    cartonSize: "9 Retail Units",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400",
  },
];

const FAVOURITES = [
  {
    id: 3,
    name: "Royal Assorted Hamper",
    sku: "HMP-ROY-05",
    price: 8500,
    cartonSize: "4 Master Cartons",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: 4,
    name: "Rose Petal Mamoul",
    sku: "MAM-ROS-01",
    price: 3200,
    cartonSize: "12 Retail Units",
    image: "https://images.unsplash.com/photo-1605697843475-430263690d0e?auto=format&fit=crop&q=80&w=400",
  },
];

const RECOMMENDATIONS = [
  {
    id: 5,
    name: "Chocolate Coated Dates",
    sku: "DAT-CHO-03",
    price: 2900,
    cartonSize: "15 Retail Units",
    badge: "Trending",
    image: "https://images.unsplash.com/photo-1517409540061-6453965fc187?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: 6,
    name: "Walnut Tart Baklawa",
    sku: "BAK-TRT-04",
    price: 4100,
    cartonSize: "9 Retail Units",
    badge: "New Arrival",
    image: "https://images.unsplash.com/photo-1615486171448-4fb651475c74?auto=format&fit=crop&q=80&w=400",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All SKUs");

  const handleAddToCart = (item: any) => {
    toast.success(`Added 1 Master Carton of ${item.name} to procurement cart.`, { icon: "📦" });
  };

  const ProductCard = ({ item }: { item: any }) => (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
    >
      <div className="relative h-48 overflow-hidden bg-slate-100">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {item.badge && (
          <span className="absolute top-3 left-3 bg-[#B8860B] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
            {item.badge}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SKU: {item.sku}</p>
          <h3 className="font-bold text-slate-900 leading-tight mb-1">{item.name}</h3>
          <p className="text-xs text-slate-500 font-medium">{item.cartonSize} per Master Carton</p>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <p className="font-black text-lg text-slate-900">₹{item.price.toLocaleString("en-IN")}</p>
          <button
            onClick={() => handleAddToCart(item)}
            className="w-10 h-10 rounded-full bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center hover:bg-[#B8860B] hover:text-white hover:border-[#B8860B] transition-colors shadow-sm"
          >
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-[#B8860B] selection:text-white">
      <TopNavBar />

      <main className="pt-20">
        {/* 1. TOP BANNER: SEASON'S SPECIAL */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto mt-6">
          <div className="bg-slate-900 rounded-3xl overflow-hidden relative shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent z-10"></div>
            <img
              src="https://images.unsplash.com/photo-1605697843475-430263690d0e?auto=format&fit=crop&q=80&w=1200"
              alt="Gifting"
              className="absolute inset-0 w-full h-full object-cover object-right opacity-60"
            />
            <div className="relative z-20 p-8 md:p-12 lg:p-16 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B8860B]/20 border border-[#B8860B]/30 text-[#E5B842] text-[10px] font-black uppercase tracking-widest mb-4 backdrop-blur-sm">
                <Gift size={12} /> Festive Procurement
              </span>
              <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
                Corporate Gifting,
                <br />
                Manufactured to Scale.
              </h1>
              <p className="text-slate-300 text-sm md:text-base font-medium mb-8 max-w-md">
                Secure your production slots for the upcoming festive season. Early volume commitments unlock priority
                manufacturing and custom packaging.
              </p>
              <div className="flex gap-4">
                <button className="px-6 py-3.5 bg-[#B8860B] text-white rounded-xl font-bold text-sm hover:bg-[#9A7009] shadow-lg shadow-[#B8860B]/20 transition-all active:scale-95 flex items-center gap-2">
                  View Catalogue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. HORIZONTAL TABS (PRODUCT CATEGORIES) */}
        <div className="sticky top-16 z-30 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex overflow-x-auto scrollbar-hide py-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${
                    activeCategory === cat
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16 mt-8">
          {/* 3. SMART REORDER */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Clock className="text-[#B8860B]" size={24} /> Smart Reorder
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Based on your recent production runs.</p>
              </div>
              <button className="text-xs font-bold text-[#B8860B] hover:text-slate-900 transition-colors flex items-center gap-1 uppercase tracking-widest">
                View History <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {SMART_REORDER.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {/* 4. MY FAVOURITES */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Star className="text-amber-400 fill-amber-400" size={24} /> My Favourites
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Your saved corporate SKUs.</p>
              </div>
              <button className="text-xs font-bold text-[#B8860B] hover:text-slate-900 transition-colors flex items-center gap-1 uppercase tracking-widest">
                Manage List <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {FAVOURITES.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {/* 5. RECOMMENDATIONS */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="text-blue-500" size={24} /> Recommended for You
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Curated additions for your portfolio.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {RECOMMENDATIONS.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {/* B2B TRUST BANNER */}
          <section className="bg-slate-900 rounded-3xl p-8 lg:p-12 text-center text-white relative overflow-hidden shadow-xl mt-12 border border-slate-800">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0,transparent_100%)]"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <PackageSearch size={48} className="mx-auto text-[#E5B842] mb-6" />
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">Need Custom Manufacturing?</h2>
              <p className="text-slate-300 mb-8 font-medium">
                Our production facility can handle bespoke formulations, private labeling, and bulk institutional
                packaging. Speak to our Floor Managers to engineer your perfect product line.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm"
              >
                Go to Buyer Dashboard
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
