import { useState } from "react";
import { Package, Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import {
  getDisplayPrice,
  getProductCategory,
  getMinOrderQty,
  getPrimaryPackWeightKg,
  unitsToFillCarton,
} from "@/utils/pricing";

interface CatalogueProductCardProps {
  item: any;
}

const CatalogueProductCard = ({ item }: CatalogueProductCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);

  const cat = getProductCategory(item);
  const displayInfo = getDisplayPrice(item);
  const weightKg = getPrimaryPackWeightKg(item);
  const moq = getMinOrderQty(item);
  const toFill = unitsToFillCarton(item, moq);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  return (
    <div
      onClick={() => navigate(`/product/${item.id}`)}
      className="bg-card rounded-2xl overflow-hidden cursor-pointer group"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      {/* Image */}
      <div className="w-full aspect-square overflow-hidden bg-background flex items-center justify-center p-4 relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <Package size={28} className="text-muted-foreground" />
        )}
        {/* Quick add overlay */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-foreground text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="font-body text-sm font-medium text-foreground line-clamp-2 leading-snug">{item.name}</p>
        <p className="font-body text-[11px] text-muted-foreground">{item.sub_category || item.category}</p>

        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="font-body text-sm text-foreground font-semibold">
              {formatPrice(displayInfo.price)}
              <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{displayInfo.unit}</span>
            </p>
            <p className="font-body text-[10px] text-muted-foreground">
              MOQ: {moq} {moq === 1 ? "pack" : "packs"}
            </p>
          </div>
        </div>

        {toFill > 0 && (
          <p className="font-body text-[9px] text-primary">
            +{toFill} more to fill carton
          </p>
        )}

        {/* Full-width Add button */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="w-full mt-1.5 bg-foreground text-primary-foreground font-body text-xs font-medium py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : null}
          {adding ? "Adding…" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
};

export default CatalogueProductCard;
