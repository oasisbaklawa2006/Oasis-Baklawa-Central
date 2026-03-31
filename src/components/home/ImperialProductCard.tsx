import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ImperialProductCardProps {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number | null;
  pack_size: string | null;
  category: string;
  variant?: "default" | "gold-bg";
}

const ImperialProductCard = ({
  id, name, image_url, base_price, pack_size, category, variant = "default",
}: ImperialProductCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const pricePerKg = base_price ?? 0;
  const weightKg = parseFloat(pack_size || "0") || 6;
  const packPrice = pricePerKg * weightKg;

  const isGold = variant === "gold-bg";

  return (
    <div
      onClick={() => navigate(`/product/${id}`)}
      className={`min-w-[165px] max-w-[180px] rounded-[20px] p-3 snap-start cursor-pointer group relative flex flex-col ${
        isGold
          ? "bg-[#F9F8F3] border-0 shadow-sm"
          : "bg-[#F9F8F3] border-[1.5px] border-[#C4A052]/40"
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-[#F9F8F3] flex items-center justify-center mb-2">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl">🍯</span>
        )}
        {/* Veg mark */}
        <div className="absolute top-1.5 right-1.5 w-4 h-4 border border-[#2E7D32] rounded-sm flex items-center justify-center bg-white/80">
          <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
        </div>
        {/* Carousel dots */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052]/30" />
        </div>
      </div>

      {/* Text — left aligned */}
      <h3 className="font-body text-[11px] font-bold text-[#4A3623] uppercase tracking-wide leading-tight line-clamp-1">{name}</h3>
      <p className="font-body text-[9px] text-[#4A3623]/60 uppercase tracking-wider mb-1">{category}</p>
      <p className="font-body text-[9px] text-[#4A3623] font-semibold">PACK SIZE : {pack_size || "6kg"}</p>
      <p className="font-body text-[9px] text-[#4A3623] font-semibold mb-1.5">PACK PRICE : {formatPrice(packPrice)}/-</p>

      {/* Price row */}
      <div className="flex items-end justify-between mt-auto">
        <div>
          <p className="font-body text-base font-bold text-[#4A3623]">
            <span className="text-[10px] align-top">₹</span> {pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}/-
          </p>
          <p className="font-body text-[7px] text-[#4A3623]/50 leading-tight">
            Excluding taxes & Transportation<br />Per kg
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/product/${id}`); }}
          className="w-8 h-8 rounded-full bg-[#4A3623] flex items-center justify-center hover:bg-[#C4A052] transition-colors flex-shrink-0"
        >
          <ShoppingCart size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
};

export default ImperialProductCard;
