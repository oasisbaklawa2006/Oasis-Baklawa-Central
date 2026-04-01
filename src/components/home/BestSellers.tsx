import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Package } from "lucide-react";
import { motion } from "framer-motion";
import { getDisplayPrice, getMinOrderQty } from "@/utils/pricing";

const BestSellers = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();

  const bestSellers = products?.slice(0, 6) || [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {bestSellers.map((product, i) => {
        const displayInfo = getDisplayPrice(product);
        const moq = getMinOrderQty(product);

        return (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2 }}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-card rounded-xl overflow-hidden cursor-pointer group"
            style={{ boxShadow: "0 1px 10px rgba(0,0,0,0.03)" }}
          >
            <div className="w-full aspect-[4/3] overflow-hidden bg-background flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
              ) : (
                <Package size={18} className="text-muted-foreground" strokeWidth={1.3} />
              )}
            </div>

            <div className="p-2.5 space-y-0.5">
              <p className="font-serif text-[11px] text-foreground line-clamp-2 leading-snug">
                {product.name}
              </p>
              <p className="font-body text-[8px] text-muted-foreground tracking-wide">
                {product.sub_category || product.category}
              </p>

              {isAuthenticated ? (
                <>
                  <p className="font-body text-[11px] text-foreground font-medium tracking-wide">
                    {formatPrice(displayInfo.price)}
                    <span className="text-[8px] font-normal text-muted-foreground ml-1">{displayInfo.unit}</span>
                  </p>
                  <p className="font-body text-[7px] text-muted-foreground tracking-wider">
                    MOQ: {moq} {moq === 1 ? "box" : "boxes"}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                    className="w-full mt-1.5 border border-primary/25 text-primary font-body text-[9px] font-medium py-1.5 rounded-full transition-all duration-200 hover:bg-primary/5 tracking-wider"
                  >
                    Add to Cart
                  </motion.button>
                </>
              ) : (
                <p className="font-body text-[9px] text-primary flex items-center gap-1 mt-1">
                  <Lock size={9} strokeWidth={1.5} /> Login for Price
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default BestSellers;
