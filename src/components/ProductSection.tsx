import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ImperialProductCard from "./home/ImperialProductCard";

interface ProductSectionProps {
  tagKey: string;
  title?: string;
  subtitle?: string;
  variant?: "default" | "gold-block";
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
    <div className="flex justify-center py-8">
      <Loader2 size={20} className="animate-spin text-[#C4A052]" />
    </div>
  );

  if (products.length === 0) return null;

  const isGold = variant === "gold-block";

  if (isGold) {
    return (
      <section className="relative -mx-4 sm:-mx-6">
        <div className="bg-[#C4A052] rounded-3xl mx-2 p-5 pb-8">
          {title && (
            <h2 className="font-display text-xl font-bold text-[#4A3623] mb-1">{title}</h2>
          )}
          {subtitle && (
            <p className="text-[10px] text-[#4A3623]/70 mb-5 font-body font-medium">{subtitle}</p>
          )}
          <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-2 snap-x">
            {products.map((item) => (
              <ImperialProductCard
                key={item.id}
                {...item}
                variant="gold-bg"
              />
            ))}
          </div>
          <p className="text-right font-display text-sm font-bold text-[#4A3623] uppercase tracking-wider mt-4 pr-2">
            PERFECT FOR PRIVATE LABELLING
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4">
      {title && (
        <h2 className="font-display text-xl font-bold text-foreground mb-1">{title}</h2>
      )}
      {subtitle && (
        <p className="text-[10px] text-muted-foreground mb-5 font-body font-medium">{subtitle}</p>
      )}
      <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4 snap-x">
        {products.map((item) => (
          <ImperialProductCard
            key={item.id}
            {...item}
            variant="default"
          />
        ))}
      </div>
    </section>
  );
};

export default ProductSection;
