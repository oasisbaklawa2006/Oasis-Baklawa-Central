import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPrice, getProductCategory, getPrimaryPackWeightKg } from "@/utils/pricing";

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

const ProductRecommendations = ({
  title = "You may also like",
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
        const filtered = excludeProductId ? data.filter((p) => p.id !== excludeProductId) : data;
        const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, 6);
        setProducts(shuffled);
        setLoading(false);
      });
  }, [excludeProductId]);

  if (loading) {
    return (
      <div className="px-5 py-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-w-[140px] h-[180px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="px-5 py-4">
      <h3 className="font-display text-lg text-foreground mb-3">{title}</h3>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 snap-x" style={{ WebkitOverflowScrolling: "touch" }}>
        {products.map((p) => {
          const displayInfo = getDisplayPrice(p);
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="min-w-[140px] max-w-[140px] snap-start cursor-pointer flex-shrink-0 group"
            >
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-2">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <Package size={20} className="text-muted-foreground" />
                )}
              </div>
              <p className="font-body text-xs text-foreground line-clamp-1 mb-0.5">{p.name}</p>
              <p className="font-body text-[11px] text-muted-foreground">
                {formatPrice(displayInfo.price)} {displayInfo.unit}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductRecommendations;
