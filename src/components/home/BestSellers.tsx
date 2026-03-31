import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Package } from "lucide-react";
import {
  getDisplayPrice,
  getMinOrderQty,
  getProductCategory,
  getPrimaryPackWeightKg,
} from "@/utils/pricing";

const BestSellers = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();

  const bestSellers = products?.slice(0, 6) || [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {bestSellers.map((product) => {
        const displayInfo = getDisplayPrice(product);
        const cat = getProductCategory(product);
        const weightKg = getPrimaryPackWeightKg(product);
        const moq = getMinOrderQty(product);

        return (
          <div
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-card rounded-xl shadow-soft overflow-hidden cursor-pointer group"
          >
            {/* Image — 65% */}
            <div className="w-full aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <Package size={24} className="text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="p-3 space-y-1">
              <p className="font-body text-sm font-medium text-foreground line-clamp-2 leading-snug">
                {product.name}
              </p>
              <p className="font-body text-[11px] text-muted-foreground">
                {product.sub_category || product.category}
              </p>

              {isAuthenticated ? (
                <>
                  <p className="font-body text-sm text-foreground font-medium">
                    {formatPrice(displayInfo.price)} <span className="text-xs font-normal text-muted-foreground">{displayInfo.unit}</span>
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    Pack: {product.pack_size || (cat === "bulk_kg" && weightKg > 0 ? `${weightKg} kg` : "Std")}
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    MOQ: {moq} {moq === 1 ? "box" : "boxes"}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                    className="w-full mt-2 bg-foreground text-primary-foreground font-body text-xs font-medium py-2 rounded-full hover:opacity-90 transition-opacity"
                  >
                    Add
                  </button>
                </>
              ) : (
                <p className="font-body text-[11px] text-primary flex items-center gap-1 mt-1">
                  <Lock size={10} /> Login for Price
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BestSellers;
