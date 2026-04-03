import { useState } from "react";
import { Package, Loader2, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import {
  getDisplayPrice,
  getMinOrderQty,
  getQtyIncrement,
} from "@/utils/pricing";

interface CatalogueProductCardProps {
  item: any;
}

const CatalogueProductCard = ({ item }: CatalogueProductCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart, updateQuantity, items } = useCart();
  const [adding, setAdding] = useState(false);

  const displayInfo = getDisplayPrice(item);
  const moq = getMinOrderQty(item);
  const increment = getQtyIncrement(item);

  // Find existing cart item by product_id (NOT by item.id)
  const cartItem = items.find((ci) => ci.product_id === item.id);
  const currentQty = cartItem?.quantity ?? 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    const newQty = currentQty + increment;
    await updateQuantity(cartItem.id, newQty);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    // If at MOQ, drop to 0 (remove)
    const newQty = currentQty <= moq ? 0 : currentQty - increment;
    await updateQuantity(cartItem.id, Math.max(0, newQty));
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
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="font-body text-sm font-medium text-foreground line-clamp-2 leading-snug">{item.name}</p>
        <p className="font-body text-[11px] text-muted-foreground">{item.sub_category || item.category}</p>

        {/* Price */}
        <div className="pt-1">
          <p className="font-body text-sm text-foreground font-semibold">
            {formatPrice(displayInfo.price)}
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{displayInfo.unit}</span>
          </p>
        </div>

        {/* MOQ & Pack Size */}
        <p className="font-body text-[10px] text-muted-foreground">
          MOQ: {moq} {moq === 1 ? "pack" : "packs"} &nbsp;|&nbsp; Pack Size: {increment}
        </p>

        {/* Quantity controls or Add button */}
        {currentQty > 0 ? (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={handleDecrement}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
            >
              <Minus size={14} className="text-foreground" />
            </button>
            <span className="font-body text-sm font-semibold text-foreground min-w-[2rem] text-center">
              {currentQty}
            </span>
            <button
              onClick={handleIncrement}
              className="w-8 h-8 rounded-full bg-foreground text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-full mt-1.5 bg-foreground text-primary-foreground font-body text-xs font-medium py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : null}
            {adding ? "Adding…" : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  );
};

export default CatalogueProductCard;
