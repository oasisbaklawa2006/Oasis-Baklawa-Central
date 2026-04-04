import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";

interface ImperialProductCardProps {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number | null;
  pack_size: string | null;
  carton_type?: string | null;
  category: string;
  variant?: "default" | "gold-bg" | "editorial";
}

const ImperialProductCard = ({
  id, name, image_url, base_price, pack_size, carton_type, category, variant = "default",
}: ImperialProductCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);

  const pricePerKg = base_price ?? 0;
  const weightKg = parseFloat(pack_size || "0") || 6;
  const packPrice = pricePerKg * weightKg;

  const isGold = variant === "gold-bg";
  const isEditorial = variant === "editorial";

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(id, 1, pack_size ?? null, carton_type ?? null);
    setAdding(false);
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
          <p className={`font-number font-bold text-foreground ${isEditorial ? "text-lg" : "text-base"}`}>
            <span className="text-[10px] align-top font-body font-light">₹</span>{pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}
            <span className="text-[9px] font-body font-light text-foreground/40 ml-0.5">/kg</span>
          </p>
          <p className="font-body text-[7px] text-foreground/30 tracking-wider uppercase mt-0.5">
            excl. taxes
          </p>
        </div>
        <button
          onClick={handleQuickAdd}
          disabled={adding}
          className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 disabled:opacity-50 ${
            isEditorial
              ? "w-9 h-9 rounded-full border border-primary text-primary hover:bg-primary hover:text-white"
              : "w-8 h-8 rounded-lg bg-[hsl(var(--foreground))] hover:opacity-90 text-[hsl(var(--background))]"
          }`}
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
};

export default ImperialProductCard;
