import AppShell from "@/components/AppShell";
import { useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import {
  Search,
  Star,
  ShoppingCart,
  Plus,
  Minus,
  Box,
  Gift,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// --- MOCK DATA ---
const QUICK_ORDER_ITEMS = [
  {
    id: "qo1",
    name: "Pistachio Pyramid Baklawa",
    sku: "BAK-PYR-01",
    price: 4500,
    cartonSize: "9 Units / Carton",
    image: "https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80&w=100",
  },
  {
    id: "qo2",
    name: "Cashew Square Baklawa",
    sku: "BAK-SQR-02",
    price: 3800,
    cartonSize: "9 Units / Carton",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=100",
  },
  {
    id: "qo3",
    name: "Rose Petal Mamoul",
    sku: "MAM-ROS-01",
    price: 3200,
    cartonSize: "12 Units / Carton",
    image: "https://images.unsplash.com/photo-1605697843475-430263690d0e?auto=format&fit=crop&q=80&w=100",
  },
];

const FAVORITES = [
  {
    id: "fav1",
    name: "Royal Assorted Hamper",
    price: 8500,
    pack: "Premium Tin",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: "fav2",
    name: "Classic Walnut Tart",
    price: 4100,
    pack: "Standard Tray",
    image: "https://images.unsplash.com/photo-1615486171448-4fb651475c74?auto=format&fit=crop&q=80&w=400",
  },
];

const CATEGORIES = [
  {
    id: "loose",
    title: "Wholesale Loose Sweets",
    image: "https://images.unsplash.com/photo-1599598425947-33002629671e?auto=format&fit=crop&q=80&w=400",
    subcategories: [
      { id: "baklawa", name: "Classic Baklawa", icon: Layers },
      { id: "tart", name: "Nut Tarts", icon: Sparkles },
      { id: "mamoul", name: "Stuffed Mamoul", icon: Box },
    ],
  },
  {
    id: "prepacked",
    title: "Prepacked Boxes",
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=400",
    subcategories: [
      { id: "retail", name: "Retail Ready", icon: Package },
      { id: "export", name: "Export Tins", icon: Box },
    ],
  },
  {
    id: "gifting",
    title: "Gifting Products",
    image: "https://images.unsplash.com/photo-1605697843475-430263690d0e?auto=format&fit=crop&q=80&w=400",
    subcategories: [
      { id: "hampers", name: "Luxury Hampers", icon: Gift },
      { id: "corporate", name: "Corporate Kits", icon: Package },
    ],
  },
  {
    id: "raw",
    title: "Raw Unprepared Baklawa",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400",
    subcategories: [
      { id: "frozen", name: "Frozen Dough", icon: Layers },
      { id: "syrup", name: "Syrups & Nuts", icon: Sparkles },
    ],
  },
  {
    id: "packaging",
    title: "Packing Accessories",
    image: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&q=80&w=400",
    subcategories: [
      { id: "rigid", name: "Rigid Boxes", icon: Box },
      { id: "trays", name: "Insert Trays", icon: Layers },
    ],
  },
];

const Catalogue = () => {
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleGenerateOrder = () => {
    const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
    if (totalItems === 0) {
      toast.error("Please add at least 1 carton to generate an order.");
      return;
    }
    // Add each item to the global CartContext
    QUICK_ORDER_ITEMS.forEach((item) => {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        addToCart({
          id: item.id,
          name: item.name,
          price_per_kg: item.price,
          pack_size: item.cartonSize,
          carton_type: null,
          image_url: item.image,
        }, qty);
      }
    });
    toast.success(`Purchase Order Generated for ${totalItems} Cartons!`, { icon: "📝" });
    navigate("/cart");
  };

  const quickOrderTotal = QUICK_ORDER_ITEMS.reduce((sum, item) => sum + item.price * (quantities[item.id] || 0), 0);

  return (
    <AppShell>
      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-32">

        {/* Universal Back Button */}
        <div className="fixed top-20 left-4 z-40 lg:hidden">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-md border border-[#C5A059]/20 flex items-center justify-center text-[#C5A059] hover:bg-[#C5A059] hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          {/* HEADER & SEARCH */}
          <div>
            <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-1">PROCUREMENT</p>
            <h1 className="text-3xl md:text-4xl font-serif text-gray-900 tracking-tight mb-6">Master Catalogue</h1>

            <div className="relative group">
              <input
                type="text"
                placeholder="Search by SKU, Product Name, or Category..."
                className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium shadow-sm focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/30 outline-none transition-all"
              />
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C5A059] group-focus-within:text-[#D4AF37] transition-colors"
                size={20}
              />
            </div>
          </div>

          {/* 1. QUICK ORDER (LIST VIEW) */}
          <section className="bg-white rounded-3xl border border-[#C5A059]/30 shadow-[0_8px_30px_-4px_rgba(197,160,89,0.15)] overflow-hidden">
            {/* GOLD BANNER HEADER */}
            <div className="bg-gradient-to-r from-[#C5A059] to-[#D4AF37] p-5 md:p-6 flex justify-between items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative z-10">
                <h2 className="text-xl font-serif text-white flex items-center gap-2 font-bold">
                  <Sparkles size={20} className="text-white/80" /> Quick Order Form
                </h2>
                <p className="text-xs text-white/90 mt-1 font-medium">
                  Enter Master Carton quantities for rapid PO generation.
                </p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#FDFCF8] border-b border-[#C5A059]/20 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">
                    <th className="p-4 pl-6 font-medium">Product & SKU</th>
                    <th className="p-4 font-medium">Logistics</th>
                    <th className="p-4 font-medium">Price/Carton</th>
                    <th className="p-4 font-medium text-center">Qty (Cartons)</th>
                    <th className="p-4 pr-6 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {QUICK_ORDER_ITEMS.map((item) => (
                    <tr key={item.id} className="hover:bg-[#C5A059]/5 transition-colors">
                      <td className="p-4 pl-6 flex items-center gap-4">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover border border-[#C5A059]/20 mix-blend-multiply"
                        />
                        <div>
                          <p className="font-bold text-sm text-gray-900">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.sku}</p>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-medium text-gray-500">{item.cartonSize}</td>
                      <td className="p-4 text-sm font-bold text-gray-900">{formatPrice(item.price)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-3 bg-white border border-[#C5A059]/30 rounded-xl px-2 py-1 w-28 mx-auto shadow-sm focus-within:ring-2 focus-within:ring-[#C5A059]/20 transition-all">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-[#C5A059] hover:bg-[#C5A059]/10 rounded p-1 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm text-gray-900 w-6 text-center">
                            {quantities[item.id] || 0}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-[#C5A059] hover:bg-[#C5A059]/10 rounded p-1 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right font-black text-[#C5A059] text-base">
                        {formatPrice((quantities[item.id] || 0) * item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#FDFCF8] p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-[#C5A059]/20">
              <div className="text-center md:text-left">
                <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-1">Order Subtotal</p>
                <p className="text-2xl font-serif text-gray-900 font-bold">
                  {formatPrice(quickOrderTotal)}
                </p>
              </div>
              <button
                onClick={handleGenerateOrder}
                className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#C5A059]/30 hover:shadow-[#C5A059]/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                Generate Purchase Order <ArrowRight size={16} />
              </button>
            </div>
          </section>

          {/* 2. MY FAVORITES */}
          <section>
            <h2 className="text-xl font-serif text-gray-900 flex items-center gap-2 mb-6">
              <Star className="text-[#C5A059] fill-[#C5A059]" size={20} /> My Favorites
            </h2>
            <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
              {FAVORITES.map((item) => (
                <div
                  key={item.id}
                  className="min-w-[240px] bg-white border border-[#C5A059]/10 rounded-2xl p-4 snap-start shadow-sm hover:border-[#C5A059]/50 hover:shadow-[0_4px_20px_rgba(197,160,89,0.15)] transition-all cursor-pointer group"
                >
                  <div className="h-36 mb-4 rounded-xl overflow-hidden bg-[#FDFCF8] flex items-center justify-center p-2 relative border border-transparent group-hover:border-[#C5A059]/20 transition-colors">
                    <img
                      src={item.image}
                      className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
                      alt={item.name}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-[#C5A059] shadow-sm"
                    >
                      <Star size={14} fill="currentColor" />
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{item.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-3">{item.pack}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm text-gray-900">{formatPrice(item.price)}</p>
                    <button
                      onClick={() => {
                        addToCart({
                          id: item.id,
                          name: item.name,
                          price_per_kg: item.price,
                          pack_size: item.pack,
                          carton_type: null,
                          image_url: item.image,
                        }, 1);
                        toast.success(`${item.name} added to cart`);
                      }}
                      className="w-8 h-8 rounded-full bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    >
                       <ShoppingCart size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. FULL CATALOGUE (CATEGORIES & SUBCATEGORIES) */}
          <section className="pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-serif text-gray-900 mb-2">Browse by Category</h2>
            <p className="text-sm text-gray-500 mb-8">Explore our complete manufacturing capabilities.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-[0_8px_30px_rgba(197,160,89,0.1)] transition-shadow"
                >
                  {/* Category Image Header */}
                  <div
                    onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
                    className="h-40 relative cursor-pointer overflow-hidden border-b border-transparent group-hover:border-[#C5A059]/30 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gray-900/40 group-hover:bg-[#C5A059]/30 transition-colors z-10 mix-blend-multiply"></div>
                    <img
                      src={category.image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      alt={category.title}
                    />
                    <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif text-xl text-white font-bold drop-shadow-md">{category.title}</h3>
                        <div
                          className={`w-8 h-8 rounded-full bg-[#C5A059] flex items-center justify-center text-white transition-transform duration-300 shadow-lg ${activeCategory === category.id ? "rotate-180" : ""}`}
                        >
                          <ChevronDown size={18} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subcategories Dropdown */}
                  <AnimatePresence>
                    {activeCategory === category.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-[#FDFCF8]"
                      >
                        <div className="p-3 grid grid-cols-2 gap-2">
                          {category.subcategories.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => navigate(`/catalogue?category=${sub.id}`)}
                              className="flex flex-col items-center justify-center p-4 rounded-xl border border-[#C5A059]/20 hover:border-[#C5A059] bg-white hover:bg-[#C5A059]/5 hover:shadow-sm transition-all text-[#C5A059] group/sub"
                            >
                              <sub.icon
                                size={24}
                                strokeWidth={1.5}
                                className="mb-2 group-hover/sub:scale-110 transition-transform"
                              />
                              <span className="text-[11px] font-bold text-center text-gray-800">{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </AppShell>
  );
};

export default Catalogue;
