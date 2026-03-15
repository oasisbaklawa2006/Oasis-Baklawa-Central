import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";
import cashewImg from "@/assets/baklawa-cashew.jpg";
import walnutImg from "@/assets/baklawa-walnut.jpg";

const recentSearches = ["Pistachio Baklawa", "Category C Cartons", "ORD-074"];

const suggestedProducts = [
  { id: "pistachio-baklawa", name: "Turkish Pistachio Baklawa", price: "₹2,250", unit: "1kg Pack", img: pistachioImg },
  { id: "cashew-roll", name: "Cashew Roll Baklawa", price: "₹1,900", unit: "500g Pack", img: cashewImg },
  { id: "walnut-diamond", name: "Walnut Diamond Cut", price: "₹1,600", unit: "500g Pack", img: walnutImg },
];

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SearchOverlay = ({ open, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filtered = query.trim()
    ? suggestedProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : suggestedProducts;

  const handleProductClick = (id: string) => {
    onClose();
    navigate(`/product/${id}`);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
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
                  placeholder="Search products, categories, or order numbers..."
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

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Recent Searches */}
              {!query && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <h3 className="font-body font-bold text-foreground text-sm">Recent Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleRecentClick(term)}
                        className="px-4 py-2 rounded-full bg-card shadow-sm border border-border font-body text-xs text-foreground font-medium hover:border-primary/50 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Suggested / Filtered Products */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-3"
              >
                <h3 className="font-body font-bold text-foreground text-sm">
                  {query ? "Results" : "Suggested Products"}
                </h3>
                <div className="space-y-3">
                  {filtered.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product.id)}
                      className="w-full flex items-center gap-4 bg-card rounded-2xl shadow-card p-3 hover:shadow-lg transition-shadow"
                    >
                      <img src={product.img} alt={product.name} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1 text-left">
                        <p className="font-body font-semibold text-foreground text-sm">{product.name}</p>
                        <p className="font-body text-[11px] text-muted-foreground">{product.unit}</p>
                        <p className="font-body font-bold text-primary text-sm">{product.price}</p>
                      </div>
                      <ArrowRight size={16} className="text-muted-foreground" />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="font-body text-sm text-muted-foreground text-center py-8">
                      No results found for "{query}"
                    </p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
