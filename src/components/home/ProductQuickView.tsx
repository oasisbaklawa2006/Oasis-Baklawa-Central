import { motion, AnimatePresence } from "framer-motion";
import { X, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { getDisplayPrice, getMinOrderQty } from "@/utils/pricing";

interface ProductQuickViewProps {
  product: any | null;
  onClose: () => void;
}

const ProductQuickView = ({ product, onClose }: ProductQuickViewProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();

  if (!product) return null;

  const displayInfo = getDisplayPrice(product);
  const moq = getMinOrderQty(product);

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-5 pb-8 max-h-[75vh] overflow-y-auto"
            style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.1)" }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <X size={14} className="text-muted-foreground" />
            </button>

            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-background flex items-center justify-center mb-4 max-w-[240px] mx-auto">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package size={32} className="text-muted-foreground" strokeWidth={1} />
              )}
            </div>

            <p className="font-body text-[8px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
              {product.sub_category || product.category}
            </p>
            <h3 className="font-display text-lg text-foreground mb-2 leading-snug">
              {product.name}
            </h3>

            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-body text-base text-foreground font-medium">
                {formatPrice(displayInfo.price)}
              </span>
              <span className="font-body text-[10px] text-muted-foreground">{displayInfo.unit}</span>
            </div>
            <p className="font-body text-[9px] text-muted-foreground mb-4">
              MOQ: {moq} {moq === 1 ? "box" : "boxes"} · Pack: {product.pack_size || "Std"}
            </p>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  await addToCart(product.id, moq, product.pack_size ?? null, product.carton_type ?? null);
                  onClose();
                }}
                className="flex-1 bg-primary text-white font-body text-[10px] font-medium py-2.5 rounded-full tracking-wider"
              >
                Add to Cart
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { onClose(); navigate(`/product/${product.id}`); }}
                className="flex-1 border border-primary/30 text-primary font-body text-[10px] font-medium py-2.5 rounded-full tracking-wider"
              >
                View Details
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductQuickView;
