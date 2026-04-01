import AppShell from "@/components/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import { Search, Loader2, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import CategoryTiles from "@/components/catalogue/CategoryTiles";
import SubcategoryTiles from "@/components/catalogue/SubcategoryTiles";
import CatalogueProductCard from "@/components/catalogue/CatalogueProductCard";
import CartonBuilderBar from "@/components/catalogue/CartonBuilderBar";
import SuggestionChips from "@/components/catalogue/SuggestionChips";

type CatalogueView = "categories" | "subcategories" | "products";

const Catalogue = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-36">
        <main className="px-4 max-w-5xl mx-auto pt-2">
          {/* Search */}
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
            <button
              className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <SlidersHorizontal size={15} className="text-muted-foreground" />
            </button>
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
                        <CatalogueProductCard key={item.id} item={item} />
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
                  <div className="grid grid-cols-2 gap-3">
                    {filtered.map((item) => (
                      <CatalogueProductCard key={item.id} item={item} />
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

        {/* Floating carton builder + suggestion chips */}
        <SuggestionChips activeCategory={activeCategory} />
        <CartonBuilderBar />
      </div>
    </AppShell>
  );
};

export default Catalogue;
