import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { Package, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { getDisplayPrice } from "@/utils/pricing";

const NewArrivals = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();

  // Show latest products (sorted by created_at desc)
  const arrivals = [...(products || [])]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 8);

  if (loading || arrivals.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="px-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-[0.5px] bg-primary/40" />
          <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
            New Arrivals
          </p>
        </div>
        <button
          onClick={() => navigate("/catalogue")}
          className="font-body text-[8px] text-primary tracking-[0.15em] uppercase"
        >
          See All
        </button>
      </div>

      <div className="flex overflow-x-auto scrollbar-hide gap-3 px-5 pb-1 snap-x">
        {arrivals.map((product, i) => {
          const displayInfo = getDisplayPrice(product);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/product/${product.id}`)}
              className="min-w-[130px] max-w-[130px] snap-start cursor-pointer flex-shrink-0 group"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-card border border-primary/6 flex items-center justify-center mb-2"
                style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                  />
                ) : (
                  <Package size={16} className="text-muted-foreground" strokeWidth={1.3} />
                )}
                <span className="absolute top-2 left-2 font-body text-[7px] tracking-[0.15em] uppercase bg-primary/90 text-white px-2 py-0.5 rounded-full">
                  New
                </span>
              </div>
              <p className="font-serif text-[10px] text-foreground line-clamp-1 mb-0.5">
                {product.name}
              </p>
              {isAuthenticated ? (
                <p className="font-body text-[9px] text-foreground font-medium">
                  {formatPrice(displayInfo.price)}
                  <span className="font-normal text-muted-foreground ml-0.5">{displayInfo.unit}</span>
                </p>
              ) : (
                <p className="font-body text-[9px] text-primary flex items-center gap-0.5">
                  <Lock size={8} strokeWidth={1.5} /> Login
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default NewArrivals;
