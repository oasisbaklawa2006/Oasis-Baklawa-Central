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
  variant?: "default" | "gold-bg" | "editorial";
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
  const isEditorial = variant === "editorial";

  return (
    <div
      onClick={() => navigate(`/product/${id}`)}
      className={`snap-start cursor-pointer group relative flex flex-col ${
        isEditorial
          ? "min-w-[200px] max-w-[220px] bg-transparent"
          : isGold
            ? "min-w-[165px] max-w-[180px] rounded-[20px] p-3 bg-[#F9F8F3]"
            : "min-w-[165px] max-w-[180px] rounded-[20px] p-3 bg-[#F9F8F3] border-[1.5px] border-[#C4A052]/20"
      }`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden flex items-center justify-center mb-3 ${
        isEditorial
          ? "aspect-[3/4] rounded-[16px] bg-[#F0EDE4]"
          : "aspect-square rounded-xl bg-[#F9F8F3]"
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
        <div className="absolute top-2 right-2 w-4 h-4 border border-[#2E7D32] rounded-sm flex items-center justify-center bg-[#F9F8F3]/90">
          <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
        </div>
      </div>

      {/* Text */}
      <p className="font-body text-[9px] font-medium tracking-[0.2em] uppercase text-[#C4A052] mb-1">{category}</p>
      <h3 className={`font-display font-semibold text-[#1A120B] leading-tight line-clamp-2 mb-2 ${
        isEditorial ? "text-[14px]" : "text-[11px] uppercase tracking-wide"
      }`}>{name}</h3>

      {!isEditorial && (
        <>
          <p className="font-body text-[9px] text-[#1A120B]/50 font-medium">PACK : {pack_size || "6kg"}</p>
          <p className="font-body text-[9px] text-[#1A120B]/50 font-medium mb-2">PACK PRICE : {formatPrice(packPrice)}/-</p>
        </>
      )}

      {/* Price row */}
      <div className="flex items-end justify-between mt-auto">
        <div>
          <p className={`font-display font-bold text-[#1A120B] ${isEditorial ? "text-lg" : "text-base"}`}>
            <span className="text-[10px] align-top font-body font-light">₹</span>{pricePerKg > 0 ? pricePerKg.toFixed(0) : "0"}
            <span className="text-[9px] font-body font-light text-[#1A120B]/40 ml-0.5">/kg</span>
          </p>
          <p className="font-body text-[7px] text-[#1A120B]/30 tracking-wider uppercase mt-0.5">
            excl. taxes
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/product/${id}`); }}
          className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            isEditorial
              ? "w-9 h-9 rounded-full border border-[#C4A052] text-[#C4A052] hover:bg-[#C4A052] hover:text-white"
              : "w-8 h-8 rounded-full bg-[#1A120B] hover:bg-[#C4A052] text-white"
          }`}
        >
          <ShoppingCart size={14} />
        </button>
      </div>
    </div>
  );
};

export default ImperialProductCard;
