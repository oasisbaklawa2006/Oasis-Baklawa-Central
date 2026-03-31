import AppShell from "@/components/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import {
  Search,
  ShoppingCart,
  Loader2,
  ChevronRight,
  Package,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  calculatePackPrice,
  getDisplayPrice,
  getProductCategory,
  getPacksPerCarton,
  getMinOrderQty,
  getPrimaryPackWeightKg,
  unitsToFillCarton,
} from "@/utils/pricing";

type CatalogueView = "categories" | "subcategories" | "products";

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

  const paramCategory = searchParams.get("category");
  const paramSubCategory = searchParams.get("subcategory");

  const [activeCategory, setActiveCategory] = useState<string | null>(paramCategory);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(paramSubCategory);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setActiveCategory(searchParams.get("category"));
    setActiveSubCategory(searchParams.get("subcategory"));
  }, [searchParams]);

  const currentView: CatalogueView = searchQuery
    ? "products"
    : activeSubCategory
    ? "products"
    : activeCategory
    ? "subcategories"
    : "categories";

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [products]);

  const subCategories = useMemo(() => {
    if (!activeCategory) return [];
    return [
      ...new Set(
        products
          .filter((p) => p.category === activeCategory)
          .map((p) => p.sub_category)
          .filter(Boolean)
      ),
    ] as string[];
  }, [products, activeCategory]);

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

  const renderBreadcrumbs = () => (
    <nav className="flex items-center gap-1.5 text-xs font-body text-muted-foreground mb-5 flex-wrap">
      <button
        onClick={navigateToRoot}
        className={`hover:text-foreground transition-colors ${currentView === "categories" ? "text-foreground font-medium" : ""}`}
      >
        Catalogue
      </button>
      {activeCategory && (
        <>
          <ChevronRight size={12} className="text-muted-foreground/40" />
          <button
            onClick={() => navigateToCategory(activeCategory)}
            className={`hover:text-foreground transition-colors ${currentView === "subcategories" ? "text-foreground font-medium" : ""}`}
          >
            {activeCategory}
          </button>
        </>
      )}
      {activeSubCategory && (
        <>
          <ChevronRight size={12} className="text-muted-foreground/40" />
          <span className="text-foreground font-medium">{activeSubCategory}</span>
        </>
      )}
    </nav>
  );

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-32">
        <main className="px-5 max-w-5xl mx-auto pt-2">
          {/* Search */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-body shadow-soft focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            </div>
            <button className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-soft">
              <SlidersHorizontal size={16} className="text-muted-foreground" />
            </button>
          </div>

          {renderBreadcrumbs()}

          {productsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <>
              {/* L1 CATEGORIES */}
              {currentView === "categories" && (
                <section>
                  <h2 className="font-display text-2xl text-foreground mb-5">Browse</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((cat) => {
                      const count = products.filter((p) => p.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => navigateToCategory(cat)}
                          className="relative aspect-[4/3] rounded-xl overflow-hidden group bg-muted"
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl group-hover:scale-110 transition-transform duration-500">
                              {CATEGORY_EMOJIS[cat] || "📦"}
                            </span>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
                          <div className="absolute bottom-3 left-3">
                            <span className="font-body text-xs font-medium text-white block">{cat}</span>
                            <span className="font-body text-[10px] text-white/60">{count} products</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* L2 SUBCATEGORIES */}
              {currentView === "subcategories" && (
                <section>
                  <h2 className="font-display text-2xl text-foreground mb-5">{activeCategory}</h2>
                  {subCategories.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {subCategories.map((sub) => {
                        const count = products.filter(
                          (p) => p.category === activeCategory && p.sub_category === sub
                        ).length;
                        return (
                          <button
                            key={sub}
                            onClick={() => navigateToSubCategory(sub)}
                            className="relative aspect-[4/3] rounded-xl overflow-hidden group bg-muted"
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-3xl group-hover:scale-110 transition-transform duration-500">
                                {CATEGORY_EMOJIS[sub] || "📦"}
                              </span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
                            <div className="absolute bottom-3 left-3">
                              <span className="font-body text-xs font-medium text-white block">{sub}</span>
                              <span className="font-body text-[10px] text-white/60">{count} products</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {filtered.map((item) => (
                        <CatalogueCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* PRODUCTS */}
              {currentView === "products" && (
                <section>
                  <h2 className="font-display text-2xl text-foreground mb-5">
                    {searchQuery ? `"${searchQuery}"` : activeSubCategory || activeCategory || "All"}
                    <span className="text-sm font-body text-muted-foreground ml-2">({filtered.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {filtered.map((item) => (
                      <CatalogueCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} />
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <p className="text-center text-muted-foreground py-12 font-body text-sm">No products found.</p>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
};

/* ── Premium Catalogue Card ── */
const CatalogueCard = ({
  item,
  navigate,
  formatPrice,
  addToCart,
}: {
  item: any;
  navigate: any;
  formatPrice: (n: number) => string;
  addToCart: any;
}) => {
  const cat = getProductCategory(item);
  const packPrice = calculatePackPrice(item);
  const displayInfo = getDisplayPrice(item);
  const weightKg = getPrimaryPackWeightKg(item);
  const moq = getMinOrderQty(item);
  const toFill = unitsToFillCarton(item, moq);

  return (
    <div
      onClick={() => navigate(`/product/${item.id}`)}
      className="bg-card rounded-xl shadow-soft overflow-hidden cursor-pointer group"
    >
      {/* Image — top 65% */}
      <div className="w-full aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center p-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <Package size={24} className="text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-0.5">
        <p className="font-body text-sm font-medium text-foreground line-clamp-2 leading-snug">{item.name}</p>
        <p className="font-body text-[11px] text-muted-foreground">{item.sub_category || item.category}</p>
        <p className="font-body text-sm text-foreground font-medium mt-1">
          {formatPrice(displayInfo.price)} <span className="text-[11px] font-normal text-muted-foreground">{displayInfo.unit}</span>
        </p>
        <p className="font-body text-[10px] text-muted-foreground">
          Pack: {item.pack_size || (cat === "bulk_kg" && weightKg > 0 ? `${weightKg} kg` : "Std")}
        </p>
        <p className="font-body text-[10px] text-muted-foreground">
          MOQ: {moq} {moq === 1 ? "box" : "boxes"}
        </p>

        {toFill > 0 && (
          <p className="font-body text-[9px] text-primary mt-1">
            Add {toFill} more to complete carton
          </p>
        )}

        <button
          onClick={async (e) => {
            e.stopPropagation();
            await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
          }}
          className="w-full mt-2 bg-foreground text-primary-foreground font-body text-xs font-medium py-2 rounded-full hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </div>
    </div>
  );
};

export default Catalogue;
