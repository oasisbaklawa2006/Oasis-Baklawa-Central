import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

interface SearchResult {
  id: string;
  name: string;
  category: string;
  sub_category: string | null;
  sku: string | null;
  image_url: string | null;
  base_price: number | null;
  pack_size: string | null;
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SearchOverlay = ({ open, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const searchTerm = `%${q.trim()}%`;
    const { data } = await supabase
      .from("products")
      .select("id, name, category, sub_category, sku, image_url, base_price, pack_size")
      .eq("is_active", true)
      .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm},category.ilike.${searchTerm}`)
      .limit(10);
    setResults((data as SearchResult[]) || []);
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => searchProducts(query), 300);
    return () => clearTimeout(timer);
  }, [query, open, searchProducts]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleProductClick = (id: string) => {
    onClose();
    navigate(`/product/${id}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 bg-card rounded-xl shadow-card px-4 py-3">
                <Search size={18} className="text-muted-foreground flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products, SKU, or category..."
                  className="flex-1 bg-transparent font-body text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center flex-shrink-0"
              >
                <X size={18} className="text-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              )}

              {!loading && query && results.length === 0 && (
                <p className="font-body text-sm text-muted-foreground text-center py-8">
                  No products found for "{query}"
                </p>
              )}

              {!loading && !query && (
                <p className="font-body text-sm text-muted-foreground text-center py-8">
                  Start typing to search products...
                </p>
              )}

              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product.id)}
                  className="w-full flex items-center gap-4 bg-card rounded-2xl shadow-card p-3 hover:shadow-lg transition-shadow"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-body font-semibold text-foreground text-sm">{product.name}</p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {product.category}{product.sub_category ? ` › ${product.sub_category}` : ""}
                      {product.sku ? ` · ${product.sku}` : ""}
                    </p>
                    {product.base_price && (
                      <p className="font-body font-bold text-primary text-sm">{formatPrice(product.base_price)}</p>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
