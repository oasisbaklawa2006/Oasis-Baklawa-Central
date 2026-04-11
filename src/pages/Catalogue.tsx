import AppShell from "@/components/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useProducts } from "@/hooks/useProducts";
import { Search, Loader2, ChevronRight, SlidersHorizontal, List, LayoutGrid, ArrowUpDown } from "lucide-react";
import GrowthIntelligenceButton from "@/components/growth/GrowthIntelligenceButton";
import { useNavigate, useSearchParams } from "react-router-dom";

import CategoryTiles from "@/components/catalogue/CategoryTiles";
import SubcategoryTiles from "@/components/catalogue/SubcategoryTiles";
import CatalogueProductCard from "@/components/catalogue/CatalogueProductCard";
import CartonBuilderBar from "@/components/catalogue/CartonBuilderBar";
import SuggestionChips from "@/components/catalogue/SuggestionChips";
import QuickOrderTable from "@/components/catalogue/QuickOrderTable";
import { useAuth } from "@/hooks/useAuth";
import { getDisplayPrice } from "@/utils/pricing";

type CatalogueView = "categories" | "subcategories" | "products";
type BrowseMode = "browse" | "quickorder";
type SortOption = "default" | "price_asc" | "price_desc";

const Catalogue = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { products, loading: productsLoading } = useProducts();
  const { user, priceTier, refreshPriceTier } = useAuth();

  const paramCategory = searchParams.get("category");
  const paramSubCategory = searchParams.get("subcategory");

  const [activeCategory, setActiveCategory] = useState<string | null>(paramCategory);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(paramSubCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("browse");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    setActiveCategory(searchParams.get("category"));
    setActiveSubCategory(searchParams.get("subcategory"));
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    void refreshPriceTier();
  }, [refreshPriceTier, user?.id]);

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
    let result: typeof products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.sub_category?.toLowerCase().includes(q)
      );
    } else {
      result = products.filter((p) => {
        if (activeCategory && p.category !== activeCategory) return false;
        if (activeSubCategory && p.sub_category !== activeSubCategory) return false;
        return true;
      });
    }

    // Apply sort
    if (sortOption !== "default") {
      result = [...result].sort((a, b) => {
        const priceA = getDisplayPrice(a, priceTier).price;
        const priceB = getDisplayPrice(b, priceTier).price;
        return sortOption === "price_asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }, [products, activeCategory, activeSubCategory, searchQuery, sortOption, priceTier]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const subCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products
      .filter((p) => p.category === activeCategory)
      .forEach((p) => {
        if (p.sub_category) counts[p.sub_category] = (counts[p.sub_category] || 0) + 1;
      });
    return counts;
  }, [products, activeCategory]);

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

  const showModeToggle = currentView === "products";

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-36">
        <main className="px-4 max-w-5xl mx-auto pt-2">
          {/* Growth Intelligence + Search */}
          <div className="flex items-center gap-2.5 mb-2">
            <GrowthIntelligenceButton variant="pill" />
          </div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-body focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                style={{ boxShadow: "var(--card-shadow)" }}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            </div>
            {/* Sort / Filter button */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center ${sortOption !== "default" ? "border-primary" : ""}`}
                style={{ boxShadow: "var(--card-shadow)" }}
              >
                <ArrowUpDown size={15} className={sortOption !== "default" ? "text-primary" : "text-muted-foreground"} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-12 z-30 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
                  {([
                    { key: "default", label: "Default" },
                    { key: "price_asc", label: "Price: Low → High" },
                    { key: "price_desc", label: "Price: High → Low" },
                  ] as { key: SortOption; label: string }[]).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortOption(opt.key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-xs font-body hover:bg-muted transition-colors ${sortOption === opt.key ? "text-primary font-semibold" : "text-foreground"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-body text-muted-foreground mb-4 flex-wrap">
            <button
              onClick={navigateToRoot}
              className={`hover:text-foreground transition-colors ${currentView === "categories" ? "text-foreground font-medium" : ""}`}
            >
              Catalogue
            </button>
            {activeCategory && (
              <>
                <ChevronRight size={11} className="text-muted-foreground/40" />
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
                <ChevronRight size={11} className="text-muted-foreground/40" />
                <span className="text-foreground font-medium">{activeSubCategory}</span>
              </>
            )}
          </nav>

          {/* Browse / Quick Order toggle */}
          {showModeToggle && (
            <div className="flex items-center gap-1 mb-4 bg-muted rounded-xl p-1">
              <button
                onClick={() => setBrowseMode("browse")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-body text-xs font-medium transition-colors ${
                  browseMode === "browse"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid size={13} />
                Browse
              </button>
              <button
                onClick={() => setBrowseMode("quickorder")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-body text-xs font-medium transition-colors ${
                  browseMode === "quickorder"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List size={13} />
                Quick Order
              </button>
            </div>
          )}

          {productsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <>
              {/* L1 CATEGORIES */}
              {currentView === "categories" && (
                <CategoryTiles
                  categories={categories}
                  productCounts={categoryCounts}
                  onSelect={navigateToCategory}
                />
              )}

              {/* L2 SUBCATEGORIES */}
              {currentView === "subcategories" && (
                <section>
                  <h2 className="font-display text-2xl text-foreground mb-4">{activeCategory}</h2>
                  {subCategories.length > 0 ? (
                    <SubcategoryTiles
                      subcategories={subCategories}
                      productCounts={subCategoryCounts}
                      onSelect={navigateToSubCategory}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filtered.map((item) => (
                        <CatalogueProductCard key={item.id} item={item} priceTier={priceTier} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* PRODUCTS */}
              {currentView === "products" && (
                <section>
                  <h2 className="font-display text-xl text-foreground mb-4">
                    {searchQuery ? `"${searchQuery}"` : activeSubCategory || activeCategory || "All"}
                    <span className="text-sm font-body text-muted-foreground ml-2">({filtered.length})</span>
                  </h2>

                  {browseMode === "quickorder" ? (
                    <QuickOrderTable products={filtered} priceTier={priceTier} />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filtered.map((item) => (
                        <CatalogueProductCard key={item.id} item={item} priceTier={priceTier} />
                      ))}
                    </div>
                  )}

                  {filtered.length === 0 && (
                    <p className="text-center text-muted-foreground py-12 font-body text-sm">No products found.</p>
                  )}
                </section>
              )}
            </>
          )}
        </main>

        {/* Floating carton builder + suggestion chips */}
        <SuggestionChips activeCategory={activeCategory} />
        <CartonBuilderBar />
      </div>
    </AppShell>
  );
};

export default Catalogue;
