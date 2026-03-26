import AppShell from "@/components/AppShell";
import { useState, useMemo } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import {
  Search,
  Star,
  ShoppingCart,
  Plus,
  Minus,
  Package,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const getProductPrice = (p: any): number =>
  p.wholesale_price ?? p.mrp ?? p.price_per_kg ?? 0;

const getPackInfo = (p: any): string =>
  [p.pack_size, p.carton_type].filter(Boolean).join(" · ") || "Standard";

const Catalogue = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get("category")
  );
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const activeFestival = searchParams.get("festival");
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const { products, loading: productsLoading } = useProducts();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Dynamic categories from real data
  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [products]);

  // Sub-categories for the active category
  const subCategories = useMemo(() => {
    if (!activeCategory) return [];
    return [...new Set(
      products
        .filter((p) => p.category === activeCategory)
        .map((p) => p.sub_category)
        .filter(Boolean)
    )] as string[];
  }, [products, activeCategory]);

  // Reset sub-category when primary category changes
  const effectiveSubCategory = activeCategory ? activeSubCategory : null;

  const clearFestivalFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("festival");
    navigate({ search: newParams.toString() }, { replace: true });
  };

  // Filter products by search + category + sub-category + festival
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeFestival && !(p.festival_tags || "").toLowerCase().includes(activeFestival.toLowerCase())) return false;
      if (activeCategory && p.category !== activeCategory) return false;
      if (effectiveSubCategory && p.sub_category !== effectiveSubCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q)) ||
        (p.category?.toLowerCase().includes(q))
      );
    });
  }, [products, activeCategory, effectiveSubCategory, searchQuery, activeFestival]);

  // Quick order uses first 6 filtered products
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
              {/* CATEGORY FILTER PILLS */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveCategory(null);
                      setActiveSubCategory(null);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                      !activeCategory
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    All ({products.length})
                  </button>
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(activeCategory === cat ? null : cat);
                          setActiveSubCategory(null);
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                          activeCategory === cat
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-card text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SUB-CATEGORY PILLS */}
              {subCategories.length > 0 && activeCategory && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubCategory(null)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                      !activeSubCategory
                        ? "bg-foreground text-background border-foreground shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:border-foreground/50"
                    }`}
                  >
                    All {activeCategory}
                  </button>
                  {subCategories.map((sub) => {
                    const count = products.filter(
                      (p) => p.category === activeCategory && p.sub_category === sub
                    ).length;
                    return (
                      <button
                        key={sub}
                        onClick={() => setActiveSubCategory(activeSubCategory === sub ? null : sub)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                          activeSubCategory === sub
                            ? "bg-foreground text-background border-foreground shadow-sm"
                            : "bg-card text-muted-foreground border-border hover:border-foreground/50"
                        }`}
                      >
                        {sub} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

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
                  <Star className="text-primary fill-primary" size={20} /> {activeCategory ? `${activeCategory}` : "All Products"} ({filtered.length})
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
                      {item.category && <p className="text-[10px] text-primary font-bold mb-1">{item.category}</p>}
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
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

export default Catalogue;
