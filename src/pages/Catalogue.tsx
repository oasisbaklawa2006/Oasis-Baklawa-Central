import AppShell from "@/components/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import {
  Search,
  Star,
  ShoppingCart,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronRight,
  Info,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  calculatePackPrice,
  calculateCartonPrice,
  getDisplayPrice,
  getProductCategory,
  getPacksPerCarton,
  getMinOrderQty,
  getQtyIncrement,
  getPrimaryPackWeightKg,
  getBasePricePerKg,
  getBasePricePerPc,
  unitsToFillCarton,
} from "@/utils/pricing";

type CatalogueView = "categories" | "subcategories" | "products";

const getPackSubtitle = (p: any): string => {
  const cat = getProductCategory(p);
  const perCarton = getPacksPerCarton(p);
  const weightKg = getPrimaryPackWeightKg(p);
  if (cat === "bulk_kg" && weightKg > 0) {
    return `${weightKg}kg / box · ${perCarton} boxes / carton`;
  }
  return `${perCarton} pcs / carton`;
};

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

const Catalogue = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const { products, loading: productsLoading } = useProducts();

  // Hierarchy state
  const paramCategory = searchParams.get("category");
  const paramSubCategory = searchParams.get("subcategory");

  const [activeCategory, setActiveCategory] = useState<string | null>(paramCategory);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(paramSubCategory);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick order state
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Sync URL params
  useEffect(() => {
    setActiveCategory(searchParams.get("category"));
    setActiveSubCategory(searchParams.get("subcategory"));
  }, [searchParams]);

  // Determine current view
  const currentView: CatalogueView = searchQuery
    ? "products"
    : activeSubCategory
    ? "products"
    : activeCategory
    ? "subcategories"
    : "categories";

  // L1 categories
  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [products]);

  // L2 subcategories for active category
  const subCategories = useMemo(() => {
    if (!activeCategory) return [];
    const subs = [
      ...new Set(
        products
          .filter((p) => p.category === activeCategory)
          .map((p) => p.sub_category)
          .filter(Boolean)
      ),
    ] as string[];
    return subs;
  }, [products, activeCategory]);

  // Filtered products (only shown in products view)
  const filtered = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.sub_category?.toLowerCase().includes(q)
      );
    }
    return products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (activeSubCategory && p.sub_category !== activeSubCategory) return false;
      return true;
    });
  }, [products, activeCategory, activeSubCategory, searchQuery]);

  // Navigation helpers
  const navigateToCategory = (cat: string) => {
    navigate(`/catalogue?category=${encodeURIComponent(cat)}`, { replace: true });
  };

  const navigateToSubCategory = (sub: string) => {
    navigate(
      `/catalogue?category=${encodeURIComponent(activeCategory!)}&subcategory=${encodeURIComponent(sub)}`,
      { replace: true }
    );
  };

  const navigateToRoot = () => {
    navigate("/catalogue", { replace: true });
  };

  // Quick order
  const updateQuantity = (id: string, delta: number, moq: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      // Ensure it's a multiple of MOQ (or 0)
      if (next > 0 && next < moq) return { ...prev, [id]: moq };
      return { ...prev, [id]: next };
    });
  };

  const handleGenerateOrder = async () => {
    const itemsToOrder = filtered.filter((p) => (quantities[p.id] || 0) > 0);
    if (itemsToOrder.length === 0) {
      toast.error("Please add at least 1 item to generate an order.");
      return;
    }
    setIsAddingToCart(true);
    for (const item of itemsToOrder) {
      const qty = quantities[item.id] || 0;
      await addToCart(item.id, qty, item.pack_size ?? null, item.carton_type ?? null);
    }
    setIsAddingToCart(false);
    toast.success("Purchase Order Generated!", { icon: "📝" });
    navigate("/cart");
  };

  const quickOrderTotal = filtered.reduce(
    (sum, p) => sum + calculatePackPrice(p) * (quantities[p.id] || 0),
    0
  );

  // Breadcrumbs
  const renderBreadcrumbs = () => (
    <nav className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-4 flex-wrap">
      <button
        onClick={navigateToRoot}
        className={`hover:text-primary transition-colors ${currentView === "categories" ? "text-foreground font-bold" : ""}`}
      >
        Catalogue
      </button>
      {activeCategory && (
        <>
          <ChevronRight size={12} className="text-muted-foreground/50" />
          <button
            onClick={() => navigateToCategory(activeCategory)}
            className={`hover:text-primary transition-colors ${currentView === "subcategories" ? "text-foreground font-bold" : ""}`}
          >
            {activeCategory}
          </button>
        </>
      )}
      {activeSubCategory && (
        <>
          <ChevronRight size={12} className="text-muted-foreground/50" />
          <span className="text-foreground font-bold">{activeSubCategory}</span>
        </>
      )}
    </nav>
  );

  return (
    <AppShell>
      <div className="min-h-screen bg-background font-sans pb-32">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
          {/* HEADER & SEARCH */}
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">PROCUREMENT</p>
            <h1 className="text-3xl md:text-4xl font-serif text-foreground tracking-tight mb-4">
              Master Catalogue
            </h1>
            {renderBreadcrumbs()}
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
              {/* VIEW: L1 CATEGORIES */}
              {currentView === "categories" && (
                <section>
                  <h2 className="text-lg font-serif text-foreground mb-6 flex items-center gap-2">
                    <Star className="text-primary fill-primary" size={18} /> Browse Categories
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.map((cat) => {
                      const count = products.filter((p) => p.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => navigateToCategory(cat)}
                          className="flex flex-col items-center justify-center bg-card p-6 rounded-2xl border border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all active:scale-95 group"
                        >
                          <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                            {CATEGORY_EMOJIS[cat] || "📦"}
                          </span>
                          <span className="text-sm font-bold text-foreground text-center">{cat}</span>
                          <span className="text-[10px] text-muted-foreground mt-1">{count} products</span>
                        </button>
                      );
                    })}
                  </div>
                  {categories.length === 0 && (
                    <p className="text-center text-muted-foreground py-12">No categories found.</p>
                  )}
                </section>
              )}

              {/* VIEW: L2 SUBCATEGORIES */}
              {currentView === "subcategories" && (
                <section>
                  <h2 className="text-lg font-serif text-foreground mb-6 flex items-center gap-2">
                    <Star className="text-primary fill-primary" size={18} /> {activeCategory}
                  </h2>
                  {subCategories.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {subCategories.map((sub) => {
                        const count = products.filter(
                          (p) => p.category === activeCategory && p.sub_category === sub
                        ).length;
                        return (
                          <button
                            key={sub}
                            onClick={() => navigateToSubCategory(sub)}
                            className="flex flex-col items-center justify-center bg-card p-6 rounded-2xl border border-border shadow-sm hover:border-primary/50 hover:shadow-md transition-all active:scale-95 group"
                          >
                            <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                              {CATEGORY_EMOJIS[sub] || "📦"}
                            </span>
                            <span className="text-sm font-bold text-foreground text-center">{sub}</span>
                            <span className="text-[10px] text-muted-foreground mt-1">{count} products</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    // No subcategories — show products directly
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filtered.map((item) => (
                        <ProductCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* VIEW: PRODUCTS */}
              {currentView === "products" && (
                <section>
                  <h2 className="text-lg font-serif text-foreground mb-6 flex items-center gap-2">
                    <Star className="text-primary fill-primary" size={18} />{" "}
                    {searchQuery ? `Results for "${searchQuery}"` : activeSubCategory || activeCategory || "All Products"}{" "}
                    ({filtered.length})
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map((item) => (
                      <ProductCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} />
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <p className="text-center text-muted-foreground py-12">No products found.</p>
                  )}
                </section>
              )}

              {/* QUICK ORDER — at bottom, only when viewing products */}
              {currentView === "products" && filtered.length > 0 && (
                <section className="bg-card rounded-3xl border border-primary/30 shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.15)] overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-primary/80 p-5 md:p-6 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-serif text-primary-foreground flex items-center gap-2 font-bold">
                        <Sparkles size={20} className="text-primary-foreground/80" /> Quick Order
                      </h2>
                      <p className="text-xs text-primary-foreground/90 mt-1 font-medium">
                        Enter quantities for rapid PO generation. MOQ enforced.
                      </p>
                    </div>
                  </div>

                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-muted border-b border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest">
                          <th className="p-4 pl-6 font-medium">Product & SKU</th>
                          <th className="p-4 font-medium">Pack Info</th>
                          <th className="p-4 font-medium">Price/Unit</th>
                          <th className="p-4 font-medium text-center">Qty (MOQ Step)</th>
                          <th className="p-4 pr-6 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.slice(0, 20).map((item) => {
                          const moq = getMinOrderQty(item);
                          const increment = getQtyIncrement(item);
                          const qty = quantities[item.id] || 0;
                          const packsPerCarton = getPacksPerCarton(item);
                          const toFill = unitsToFillCarton(item, qty);
                          return (
                            <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                              <td className="p-4 pl-6 flex items-center gap-4">
                                <img
                                  src={item.image_url || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-12 h-12 rounded-lg object-cover border border-primary/20"
                                />
                                <div>
                                  <p className="font-bold text-sm text-foreground">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                    {item.sku || "—"}
                                  </p>
                                </div>
                              </td>
                              <td className="p-4 text-xs font-medium text-muted-foreground">
                                {getPackSubtitle(item)}
                              </td>
                              <td className="p-4 text-sm font-bold text-foreground">
                                {formatPrice(getDisplayPrice(item).price)}
                                <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                  {getDisplayPrice(item).unit}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center justify-center gap-3 bg-card border border-primary/30 rounded-xl px-2 py-1 w-28 mx-auto shadow-sm">
                                    <button
                                      onClick={() => updateQuantity(item.id, -increment, moq)}
                                      className="text-primary hover:bg-primary/10 rounded p-1 transition-colors"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="font-bold text-sm text-foreground w-6 text-center">
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() => updateQuantity(item.id, increment, moq)}
                                      className="text-primary hover:bg-primary/10 rounded p-1 transition-colors"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                  {qty > 0 && toFill > 0 && (
                                    <p className="text-[9px] text-primary/70 font-medium flex items-center gap-0.5">
                                      <Info size={10} /> Add {toFill} more for full carton
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 pr-6 text-right font-black text-primary text-base">
                                {formatPrice(qty * calculatePackPrice(item))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-muted p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-primary/20">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                        Order Subtotal
                      </p>
                      <p className="text-2xl font-serif text-foreground font-bold">
                        {formatPrice(quickOrderTotal)}
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateOrder}
                      disabled={isAddingToCart}
                      className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isAddingToCart ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          Generate Purchase Order <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

// Extracted product card component
const ProductCard = ({
  item,
  navigate,
  formatPrice,
  addToCart,
}: {
  item: any;
  navigate: any;
  formatPrice: (n: number) => string;
  addToCart: any;
}) => (
  <div
    onClick={() => navigate(`/product/${item.id}`)}
    className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
  >
    <div className="h-36 mb-4 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center p-2">
      <img
        src={item.image_url || "/placeholder.svg"}
        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
        alt={item.name}
      />
    </div>
    <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-2">{item.name}</h3>
    <p className="text-xs text-muted-foreground font-medium capitalize mb-3">{getPackSubtitle(item)}</p>
    <div className="flex items-center justify-between">
      <div>
        {getProductCategory(item) === "bulk_kg" ? (
          <>
            <p className="text-lg font-bold text-foreground">
              {formatPrice(calculatePackPrice(item))}
              <span className="text-xs text-muted-foreground font-normal ml-1">/ box</span>
            </p>
            <p className="text-xs text-muted-foreground">
              ({formatPrice(getBasePricePerKg(item))} / kg)
            </p>
          </>
        ) : (
          <p className="text-lg font-bold text-foreground">
            {formatPrice(getBasePricePerPc(item))}
            <span className="text-xs text-muted-foreground font-normal ml-1">/ pc</span>
          </p>
        )}
      </div>
      {(item.stock ?? 1) > 0 ? (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const moq = getMinOrderQty(item);
            await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
          }}
          className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
        >
          <ShoppingCart size={14} />
        </button>
      ) : (
        <span className="text-[10px] font-bold text-destructive uppercase">Out of Stock</span>
      )}
    </div>
  </div>
);

export default Catalogue;
