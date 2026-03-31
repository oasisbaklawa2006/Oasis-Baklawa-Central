import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Package, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { calculatePackPrice, getDisplayPrice, getPrimaryPackWeightKg, getProductCategory } from "@/utils/pricing";

interface RecommendedProduct {
  id: string;
  name: string;
  image_url: string | null;
  wholesale_price: number | null;
  mrp: number | null;
  price_per_kg: number | null;
  avg_weight_per_pack: number | null;
  net_weight_grams: number | null;
  pack_size: string | null;
  category: string | null;
  sub_category: string | null;
  uom: string | null;
  base_price: number | null;
  mrp_per_pc: number | null;
  dietary_tags: string[] | null;
}

interface Props {
  title?: string;
  excludeProductId?: string;
}

const getPrice = (p: RecommendedProduct) => calculatePackPrice(p);

const ProductRecommendations = ({
  title = "You may also like:",
  excludeProductId,
}: Props) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, image_url, wholesale_price, mrp, price_per_kg, avg_weight_per_pack, net_weight_grams, pack_size, category, sub_category, uom, base_price, mrp_per_pc, dietary_tags")
      .eq("is_active", true)
      .limit(20)
      .then(({ data }) => {
        if (!data) return setLoading(false);
        const filtered = excludeProductId
          ? data.filter((p) => p.id !== excludeProductId)
          : data;
        const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 4);
        setProducts(shuffled);
        setLoading(false);
      });
  }, [excludeProductId]);

  if (loading) {
    return (
      <div className="py-6 px-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="min-w-[160px] h-[240px] rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="pt-4 pb-2 bg-[#F9F8F3]">
      <h3 className="px-5 text-sm font-light uppercase tracking-widest text-[#4A3623] mb-3" style={{ fontFamily: "var(--font-body)" }}>
        {title}
      </h3>
      <div
        className="flex flex-row overflow-x-auto overflow-y-hidden snap-x gap-4 px-5 pb-3 scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {products.map((p) => {
          const packPrice = getPrice(p);
          const displayInfo = getDisplayPrice(p);
          const cat = getProductCategory(p);
          const weightKg = getPrimaryPackWeightKg(p);
          const dietaryTags: string[] = p.dietary_tags || [];
          const isVeg = dietaryTags.some((t) => t.toLowerCase().includes("veg"));

          return (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="w-[75vw] max-w-[280px] min-w-[220px] bg-[#F9F8F3] rounded-[24px] border-[1.5px] border-[#C4A052] p-4 flex-shrink-0 cursor-pointer active:scale-95 transition-transform relative snap-center"
            >
              {/* Image — no white bg */}
              <div className="relative w-full aspect-square rounded-[12px] mb-2 p-2 flex items-center justify-center overflow-hidden bg-[#F9F8F3]">
                {/* Veg mark always shown */}
                <div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 border border-[#2E7D32] rounded-sm flex items-center justify-center bg-[#F9F8F3]">
                  <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                </div>
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                ) : (
                  <Package size={24} className="text-[#C4A052]" />
                )}
              </div>

              {/* Title — left aligned */}
              <p className="text-[#4A3623] text-[11px] font-light uppercase tracking-wider line-clamp-2 mb-1" style={{ fontFamily: "var(--font-body)" }}>
                {p.name}
              </p>

              {/* Pack info */}
              <p className="text-[#4A3623] text-[10px] font-bold mb-1" style={{ fontFamily: "var(--font-body)" }}>
                Pack : {p.pack_size || (cat === "bulk_kg" && weightKg > 0 ? `${weightKg} kg` : "Std")}
              </p>

              {/* Price */}
              <p className="text-[#C4A052] text-sm font-bold" style={{ fontFamily: "var(--font-body)" }}>
                {formatPrice(displayInfo.price)} {displayInfo.unit}
              </p>
              <p className="text-[#4A3623]/40 text-[7px] uppercase tracking-wider mt-0.5">
                Taxes Extra
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductRecommendations;
