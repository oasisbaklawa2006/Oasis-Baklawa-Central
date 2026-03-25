import AppShell from "@/components/AppShell";
import { useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
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
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

const getProductPrice = (p: any): number =>
  p.wholesale_price ?? p.mrp ?? p.price_per_kg ?? 0;

const getPackInfo = (p: any): string =>
  [p.pack_size, p.carton_type].filter(Boolean).join(" · ") || "Standard";

const Catalogue = () => {
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const { products, loading: productsLoading } = useProducts();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Filter products by search
  const filtered = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku?.toLowerCase().includes(q)) ||
      (p.category?.toLowerCase().includes(q))
    );
  });

  // Quick order uses first 6 products
  const quickOrderProducts = filtered.slice(0, 6);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleGenerateOrder = async () => {
    const itemsToOrder = quickOrderProducts.filter((p) => (quantities[p.id] || 0) > 0);
    if (itemsToOrder.length === 0) {
      toast.error("Please add at least 1 carton to generate an order.");
      return;
    }
    setIsAddingToCart(true);
    for (const item of itemsToOrder) {
      const qty = quantities[item.id] || 0;
      await addToCart(item.id, qty, item.pack_size ?? null, item.carton_type ?? null);
    }
    setIsAddingToCart(false);
    const totalItems = itemsToOrder.reduce((s, p) => s + (quantities[p.id] || 0), 0);
    toast.success(`Purchase Order Generated for ${totalItems} Cartons!`, { icon: "📝" });
    navigate("/cart");
  };

  const quickOrderTotal = quickOrderProducts.reduce(
    (sum, p) => sum + getProductPrice(p) * (quantities[p.id] || 0),
    0
  );

  return (
    <AppShell>
      <div className="min-h-screen bg-background font-sans pb-32">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-12">
          {/* HEADER & SEARCH */}
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">PROCUREMENT</p>
            <h1 className="text-3xl md:text-4xl font-serif text-foreground tracking-tight mb-6">Master Catalogue</h1>
            <div className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by SKU, Product Name, or Category..."
                className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={20} />
            </div>
          </div>

          {productsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
              <span className="ml-3 text-muted-foreground">Loading products…</span>
            </div>
          ) : (
            <>
              {/* 1. QUICK ORDER */}
              <section className="bg-card rounded-3xl border border-primary/30 shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.15)] overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary/80 p-5 md:p-6 flex justify-between items-center relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-xl font-serif text-primary-foreground flex items-center gap-2 font-bold">
                      <Sparkles size={20} className="text-primary-foreground/80" /> Quick Order Form
                    </h2>
                    <p className="text-xs text-primary-foreground/90 mt-1 font-medium">
                      Enter Master Carton quantities for rapid PO generation.
                    </p>
                  </div>
                </div>

                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-muted border-b border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest">
                        <th className="p-4 pl-6 font-medium">Product & SKU</th>
                        <th className="p-4 font-medium">Pack / Carton</th>
                        <th className="p-4 font-medium">Price/Unit</th>
                        <th className="p-4 font-medium text-center">Qty (Cartons)</th>
                        <th className="p-4 pr-6 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quickOrderProducts.map((item) => (
                        <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                          <td className="p-4 pl-6 flex items-center gap-4">
                            <img
                              src={item.image_url || "/placeholder.svg"}
                              alt={item.name}
                              className="w-12 h-12 rounded-lg object-cover border border-primary/20"
                            />
                            <div>
                              <p className="font-bold text-sm text-foreground">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku || "—"}</p>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-medium text-muted-foreground">{getPackInfo(item)}</td>
                          <td className="p-4 text-sm font-bold text-foreground">{formatPrice(getProductPrice(item))}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-3 bg-card border border-primary/30 rounded-xl px-2 py-1 w-28 mx-auto shadow-sm">
                              <button onClick={() => updateQuantity(item.id, -1)} className="text-primary hover:bg-primary/10 rounded p-1 transition-colors">
                                <Minus size={14} />
                              </button>
                              <span className="font-bold text-sm text-foreground w-6 text-center">{quantities[item.id] || 0}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="text-primary hover:bg-primary/10 rounded p-1 transition-colors">
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-right font-black text-primary text-base">
                            {formatPrice((quantities[item.id] || 0) * getProductPrice(item))}
                          </td>
                        </tr>
                      ))}
                      {quickOrderProducts.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No products found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-muted p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-primary/20">
                  <div className="text-center md:text-left">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Order Subtotal</p>
                    <p className="text-2xl font-serif text-foreground font-bold">{formatPrice(quickOrderTotal)}</p>
                  </div>
                  <button
                    onClick={handleGenerateOrder}
                    disabled={isAddingToCart}
                    className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAddingToCart ? <Loader2 size={16} className="animate-spin" /> : <>Generate Purchase Order <ArrowRight size={16} /></>}
                  </button>
                </div>
              </section>

              {/* 2. ALL PRODUCTS GRID */}
              <section>
                <h2 className="text-xl font-serif text-foreground flex items-center gap-2 mb-6">
                  <Star className="text-primary fill-primary" size={20} /> All Products ({filtered.length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/product/${item.id}`)}
                      className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="h-36 mb-4 rounded-xl overflow-hidden bg-muted flex items-center justify-center p-2">
                        <img
                          src={item.image_url || "/placeholder.svg"}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          alt={item.name}
                        />
                      </div>
                      <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-2">{item.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{getPackInfo(item)}</p>
                      {item.sku && <p className="text-[10px] text-muted-foreground font-mono mb-3">{item.sku}</p>}
                      <div className="flex items-center justify-between">
                        <p className="font-black text-sm text-foreground">{formatPrice(getProductPrice(item))}</p>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await addToCart(item.id, 1, item.pack_size ?? null, item.carton_type ?? null);
                          }}
                          className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                        >
                          <ShoppingCart size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {filtered.length === 0 && !productsLoading && (
                  <p className="text-center text-muted-foreground py-12">No products match your search.</p>
                )}
              </section>

              {/* 3. BROWSE BY CATEGORY */}
              <section className="pt-8 border-t border-border">
                <h2 className="text-2xl font-serif text-foreground mb-2">Browse by Category</h2>
                <p className="text-sm text-muted-foreground mb-8">Explore our complete manufacturing capabilities.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {CATEGORIES.map((category) => (
                    <div key={category.id} className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
                      <div
                        onClick={() => setActiveCategory(activeCategory === category.id ? null : category.id)}
                        className="h-40 relative cursor-pointer overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gray-900/40 group-hover:bg-primary/30 transition-colors z-10 mix-blend-multiply"></div>
                        <img src={category.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={category.title} />
                        <div className="absolute inset-0 z-20 p-6 flex flex-col justify-end">
                          <div className="flex items-center justify-between">
                            <h3 className="font-serif text-xl text-white font-bold drop-shadow-md">{category.title}</h3>
                            <div className={`w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-transform duration-300 shadow-lg ${activeCategory === category.id ? "rotate-180" : ""}`}>
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <AnimatePresence>
                        {activeCategory === category.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-muted">
                            <div className="p-3 grid grid-cols-2 gap-2">
                              {category.subcategories.map((sub) => (
                                <button
                                  key={sub.id}
                                  onClick={() => navigate(`/catalogue?category=${sub.id}`)}
                                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-primary/20 hover:border-primary bg-card hover:bg-primary/5 transition-all text-primary group/sub"
                                >
                                  <sub.icon size={24} strokeWidth={1.5} className="mb-2 group-hover/sub:scale-110 transition-transform" />
                                  <span className="text-[11px] font-bold text-center text-foreground">{sub.name}</span>
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
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

export default Catalogue;
