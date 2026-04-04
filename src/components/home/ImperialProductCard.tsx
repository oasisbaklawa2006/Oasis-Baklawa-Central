import { useNavigate } from "react-router-dom";
import { Plus, Minus, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";
import { getDisplayPrice, getMinOrderQty, getQtyIncrement } from "@/utils/pricing";

interface ImperialProductCardProps {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number | null;
  pack_size: string | null;
  carton_type?: string | null;
  category: string;
  mrp?: number | null;
  variant?: "default" | "gold-bg" | "editorial";
}

const ImperialProductCard = ({
  id, name, image_url, base_price, pack_size, carton_type, category, mrp: mrpProp, variant = "default",
}: ImperialProductCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart, updateQuantity, items } = useCart();
  const [adding, setAdding] = useState(false);

  // Build a pseudo-product for pricing utils
  const pseudoProduct = { id, name, base_price, pack_size, carton_type, category, mrp: mrpProp, uom: "Kg" };
  const displayInfo = getDisplayPrice(pseudoProduct);
  const moq = getMinOrderQty(pseudoProduct);
  const increment = getQtyIncrement(pseudoProduct);

  const pricePerKg = displayInfo.price || (base_price ?? 0);
  const weightKg = parseFloat(pack_size || "0") || 6;
  const packPrice = pricePerKg * weightKg;
  const mrp = Number(mrpProp) || 0;
  const showMrpStrike = mrp > 0 && pricePerKg > 0 && Math.abs(mrp - pricePerKg) > 0.5;

  const cartItem = items.find((ci) => ci.product_id === id);
  const currentQty = cartItem?.quantity ?? 0;

  const isGold = variant === "gold-bg";
  const isEditorial = variant === "editorial";

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(id, moq, pack_size ?? null, carton_type ?? null);
    setAdding(false);
  };

  const handleInc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    await updateQuantity(cartItem.id, currentQty + increment);
  };

  const handleDec = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    const newQty = currentQty <= moq ? 0 : currentQty - increment;
    await updateQuantity(cartItem.id, Math.max(0, newQty));
  };

  return (
    <div
      onClick={() => navigate(`/product/${id}`)}
      className={`snap-start cursor-pointer group relative flex flex-col ${
        isEditorial
          ? "min-w-[200px] max-w-[220px] bg-transparent"
          : isGold
            ? "min-w-[165px] max-w-[180px] rounded-[20px] p-3 bg-[hsl(var(--background))]"
            : "min-w-[165px] max-w-[180px] rounded-[20px] p-3 bg-[hsl(var(--background))] border-[1.5px] border-primary/20"
      }`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden flex items-center justify-center mb-3 ${
        isEditorial
          ? "aspect-[3/4] rounded-[16px] bg-background"
          : "aspect-square rounded-xl bg-background"
      }`}>
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl">🍯</span>
        )}
        {/* Veg mark */}
        <div className="absolute top-2 right-2 w-4 h-4 border border-[hsl(142,48%,34%)] rounded-sm flex items-center justify-center bg-background/90">
          <div className="w-2 h-2 rounded-full bg-[hsl(142,48%,34%)]" />
        </div>
      </div>

      {/* Text */}
      <p className="font-body text-[9px] font-medium tracking-[0.2em] uppercase text-primary mb-1">{category}</p>
      <h3 className={`font-display font-semibold text-foreground leading-tight line-clamp-2 mb-2 ${
        isEditorial ? "text-[14px]" : "text-[11px] uppercase tracking-wide"
      }`}>{name}</h3>

      {!isEditorial && (
        <>
          <p className="font-body text-[9px] text-foreground/50 font-medium">PACK : {pack_size || "6kg"}</p>
          <p className="font-body text-[9px] text-foreground/50 font-medium mb-2">PACK PRICE : {formatPrice(packPrice)}/-</p>
        </>
      )}

      {/* Price row */}
      <div className="flex items-end justify-between mt-auto">
        <div>
          <div className="flex items-baseline gap-1">
            <p className={`font-number font-bold text-foreground ${isEditorial ? "text-lg" : "text-base"}`}>
              <span className="text-[10px] align-top font-body font-light">₹</span>{pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}
              <span className="text-[9px] font-body font-light text-foreground/40 ml-0.5">/kg</span>
            </p>
            {showMrpStrike && (
              <span className="font-number text-[9px] text-muted-foreground line-through">₹{mrp}</span>
            )}
          </div>
          <p className="font-body text-[7px] text-foreground/30 tracking-wider uppercase mt-0.5">
            excl. taxes
          </p>
        </div>
        {/* Qty selector or Add button */}
        {currentQty > 0 ? (
          <div className="flex items-center gap-1">
            <button onClick={handleDec} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Minus size={12} className="text-foreground" />
            </button>
            <span className="font-number text-xs font-semibold text-foreground min-w-[1.2rem] text-center">{currentQty}</span>
            <button onClick={handleInc} className="w-7 h-7 rounded-full bg-foreground text-primary-foreground flex items-center justify-center">
              <Plus size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 disabled:opacity-50 ${
              isEditorial
                ? "w-9 h-9 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                : "w-8 h-8 rounded-lg bg-[hsl(var(--foreground))] hover:opacity-90 text-[hsl(var(--background))]"
            }`}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ImperialProductCard;
