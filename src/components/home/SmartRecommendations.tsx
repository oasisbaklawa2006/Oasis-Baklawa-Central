import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Package, Lock, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getDisplayPrice, getMinOrderQty } from "@/utils/pricing";
import { useState } from "react";

const SmartRecommendations = ({ priceTier }: { priceTier?: string | null }) => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();

  const recommended = [...(products || [])]
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);

  if (loading || recommended.length === 0) return null;

  return (
    <section className="px-5 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-6 h-[0.5px] bg-primary/40" />
        <p className="font-body text-[9px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
          Recommended for You
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {recommended.map((product, i) => (
          <RecCard
            key={product.id}
            product={product}
            index={i}
            priceTier={priceTier}
            navigate={navigate}
            formatPrice={formatPrice}
            isAuthenticated={isAuthenticated}
            addToCart={addToCart}
          />
        ))}
      </div>
    </section>
  );
};

const RecCard = ({ product, index, navigate, formatPrice, isAuthenticated, addToCart, priceTier }: any) => {
  const [adding, setAdding] = useState(false);
  const displayInfo = getDisplayPrice(product, priceTier);
  const moq = getMinOrderQty(product);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(product.id, moq, product.pack_size ?? null, product.carton_type ?? null);
    setAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.04 }}
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
            <p className="font-body text-[11px] text-foreground font-medium">
              {formatPrice(displayInfo.price)}
              <span className="text-[8px] font-normal text-muted-foreground ml-1">{displayInfo.unit}</span>
            </p>
            <p className="font-body text-[7px] text-muted-foreground tracking-wider">
              MOQ: {moq} {moq === 1 ? "box" : "boxes"}
            </p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleQuickAdd}
              disabled={adding}
              className="w-full mt-1.5 bg-[hsl(var(--foreground))] text-[hsl(var(--background))] font-body text-[9px] font-medium py-[7px] rounded-lg transition-all duration-200 hover:opacity-90 tracking-wider disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              {adding ? "Adding…" : "Add"}
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
};

export default SmartRecommendations;
