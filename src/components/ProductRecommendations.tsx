import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RecommendedProduct {
  id: string;
  name: string;
  image_url: string | null;
  wholesale_price: number | null;
  mrp: number | null;
  price_per_kg: number | null;
}

interface Props {
  title?: string;
  excludeProductId?: string;
}

const getPrice = (p: RecommendedProduct) =>
  p.wholesale_price ?? p.mrp ?? p.price_per_kg ?? 0;

const ProductRecommendations = ({
  title = "You May Also Like",
  excludeProductId,
}: Props) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, image_url, wholesale_price, mrp, price_per_kg")
      .eq("is_active", true)
      .limit(20)
      .then(({ data }) => {
        if (!data) return setLoading(false);
        const filtered = excludeProductId
          ? data.filter((p) => p.id !== excludeProductId)
          : data;
        // Shuffle and pick 4
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
            <Skeleton key={i} className="min-w-[140px] h-[180px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="pt-6 pb-4 bg-card">
      <h3 className="px-5 text-lg font-serif font-bold text-foreground mb-4">
        {title}
      </h3>
      <div className="flex overflow-x-auto gap-4 px-5 pb-4 scrollbar-hide">
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate(`/product/${p.id}`)}
            className="min-w-[140px] max-w-[140px] bg-card rounded-2xl border border-border p-3 shadow-sm flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-full aspect-square bg-muted rounded-xl mb-3 p-2 flex items-center justify-center">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package size={24} className="text-muted-foreground" />
              )}
            </div>
            <p className="font-bold text-foreground text-xs leading-tight line-clamp-2">
              {p.name}
            </p>
            <p className="text-xs font-bold text-primary mt-1">
              {formatPrice(getPrice(p))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductRecommendations;
