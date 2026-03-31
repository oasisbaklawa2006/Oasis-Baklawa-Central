import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2, Package } from "lucide-react";
import { getDisplayPrice } from "@/utils/pricing";

interface ProductSectionProps {
  tagKey: string;
  title?: string;
  subtitle?: string;
  variant?: "default" | "gold-block" | "editorial" | "compact";
}

interface TaggedProduct {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number | null;
  pack_size: string | null;
  category: string;
  manual_sort_index: number | null;
}

const ProductSection = ({ tagKey, title, subtitle, variant = "default" }: ProductSectionProps) => {
  const [products, setProducts] = useState<TaggedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchData = async () => {
      const { data: tag } = await supabase
        .from("product_tags")
        .select("id, tag_label")
        .eq("tag_key", tagKey)
        .eq("is_active", true)
        .maybeSingle();

      if (!tag) { setLoading(false); return; }

      const { data: mappings } = await supabase
        .from("product_tag_mapping")
        .select("product_id, manual_sort_index")
        .eq("tag_id", tag.id)
        .order("manual_sort_index", { ascending: true, nullsFirst: false });

      if (!mappings || mappings.length === 0) { setLoading(false); return; }

      const productIds = mappings.map(m => m.product_id).filter(Boolean) as string[];
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, image_url, base_price, pack_size, category")
        .in("id", productIds)
        .eq("is_active", true);

      const sortMap: Record<string, number> = {};
      mappings.forEach(m => { if (m.product_id) sortMap[m.product_id] = m.manual_sort_index ?? 999; });

      const sorted = (prods || [])
        .map(p => ({ ...p, manual_sort_index: sortMap[p.id] ?? 999 }))
        .sort((a, b) => (a.manual_sort_index ?? 999) - (b.manual_sort_index ?? 999));

      setProducts(sorted);
      setLoading(false);
    };
    fetchData();
  }, [tagKey]);

  if (loading) return (
    <div className="flex justify-center py-6">
      <Loader2 size={18} className="animate-spin text-primary" />
    </div>
  );

  if (products.length === 0) return null;

  /* ── COMPACT (for cart suggestions) ── */
  if (variant === "compact") {
    return (
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-1 snap-x">
        {products.slice(0, 8).map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/product/${item.id}`)}
            className="min-w-[120px] max-w-[120px] snap-start cursor-pointer flex-shrink-0"
          >
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-card flex items-center justify-center mb-1.5">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
              ) : (
                <Package size={16} className="text-muted-foreground" />
              )}
            </div>
            <p className="font-body text-[11px] text-foreground line-clamp-1">{item.name}</p>
            <p className="font-body text-[10px] text-muted-foreground">
              {item.base_price ? formatPrice(item.base_price) + "/kg" : ""}
            </p>
          </div>
        ))}
      </div>
    );
  }

  /* ── DEFAULT / EDITORIAL / GOLD ── */
  return (
    <section>
      {title && (
        <div className="mb-4">
          <h2 className="font-display text-2xl text-foreground">{title}</h2>
          {subtitle && (
            <p className="font-body text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      )}
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-2 snap-x">
        {products.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/product/${item.id}`)}
            className="min-w-[140px] max-w-[140px] snap-start cursor-pointer flex-shrink-0 group"
          >
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-2">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              ) : (
                <Package size={20} className="text-muted-foreground" />
              )}
            </div>
            <p className="font-body text-xs text-foreground line-clamp-1 mb-0.5">{item.name}</p>
            <p className="font-body text-[11px] text-muted-foreground">
              {item.base_price ? formatPrice(item.base_price) + "/kg" : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductSection;
