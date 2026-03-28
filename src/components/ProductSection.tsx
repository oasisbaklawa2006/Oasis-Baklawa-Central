import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2 } from "lucide-react";

interface ProductSectionProps {
  tagKey: string;
  title?: string;
  subtitle?: string;
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

const ProductSection = ({ tagKey, title, subtitle }: ProductSectionProps) => {
  const [products, setProducts] = useState<TaggedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetch = async () => {
      // Get tag id
      const { data: tag } = await supabase
        .from("product_tags")
        .select("id, tag_label")
        .eq("tag_key", tagKey)
        .eq("is_active", true)
        .maybeSingle();

      if (!tag) { setLoading(false); return; }

      // Get mapped products
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

      // Merge sort index and sort
      const sortMap: Record<string, number> = {};
      mappings.forEach(m => { if (m.product_id) sortMap[m.product_id] = m.manual_sort_index ?? 999; });

      const sorted = (prods || [])
        .map(p => ({ ...p, manual_sort_index: sortMap[p.id] ?? 999 }))
        .sort((a, b) => (a.manual_sort_index ?? 999) - (b.manual_sort_index ?? 999));

      setProducts(sorted);
      setLoading(false);
    };
    fetch();
  }, [tagKey]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 size={20} className="animate-spin text-primary" />
    </div>
  );

  if (products.length === 0) return null;

  return (
    <section>
      {title && (
        <h2 className="text-xl font-serif font-bold text-foreground mb-1">{title}</h2>
      )}
      {subtitle && (
        <p className="text-xs text-muted-foreground mb-6 font-medium">{subtitle}</p>
      )}
      <div className="flex overflow-x-auto scrollbar-hide gap-5 pb-4 snap-x">
        {products.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/product/${item.id}`)}
            className="min-w-[200px] max-w-[220px] bg-card border border-border rounded-2xl p-4 snap-start shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="h-32 mb-3 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <span className="text-3xl">🍯</span>
              )}
            </div>
            <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-2">{item.name}</h3>
            {item.base_price && (
              <p className="text-primary font-bold text-sm">{formatPrice(item.base_price)}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProductSection;
