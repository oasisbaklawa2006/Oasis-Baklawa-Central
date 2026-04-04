import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { Loader2, Package, Plus } from "lucide-react";
import { getDisplayPrice } from "@/utils/pricing";

interface ProductSectionProps {
  tagKey: string;
  title?: string;
  subtitle?: string;
  variant?: "default" | "gold-block" | "editorial" | "compact";
  priceTier?: string | null;
}

interface TaggedProduct {
  id: string;
  name: string;
  image_url: string | null;
  price_per_kg: number | null;
  price_b2b: number | null;
  price_wholesale: number | null;
  wholesale_price: number | null;
  base_price: number | null;
  mrp: number | null;
  mrp_per_pc: number | null;
  uom: string | null;
  pack_size: string | null;
  carton_type: string | null;
  category: string;
  sub_category: string | null;
  manual_sort_index: number | null;
}

const ProductSection = ({ tagKey, title, subtitle, variant = "default", priceTier }: ProductSectionProps) => {
  const [products, setProducts] = useState<TaggedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();

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
        .select("id, name, image_url, price_per_kg, price_b2b, price_wholesale, wholesale_price, base_price, mrp, mrp_per_pc, uom, pack_size, carton_type, category, sub_category")
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
          <CompactCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} priceTier={priceTier} />
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
          (() => {
            const displayInfo = getDisplayPrice(item, priceTier);

            return (
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
                <p className="font-number text-[11px] text-muted-foreground">
                  {formatPrice(displayInfo.price)}{displayInfo.unit}
                </p>
              </div>
            );
          })()
        ))}
      </div>
    </section>
  );
};

const CompactCard = ({ item, navigate, formatPrice, addToCart, priceTier }: any) => {
  const [adding, setAdding] = useState(false);
  const displayInfo = getDisplayPrice(item, priceTier);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(item.id, 1, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  return (
    <div
      onClick={() => navigate(`/product/${item.id}`)}
      className="min-w-[120px] max-w-[120px] snap-start cursor-pointer flex-shrink-0"
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-card flex items-center justify-center mb-1.5">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <Package size={16} className="text-muted-foreground" />
        )}
        <button
          onClick={handleQuickAdd}
          disabled={adding}
          className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={12} />}
        </button>
      </div>
      <p className="font-body text-[11px] text-foreground line-clamp-1">{item.name}</p>
      <p className="font-number text-[10px] text-muted-foreground">
        {formatPrice(displayInfo.price)}{displayInfo.unit}
      </p>
    </div>
  );
};

export default ProductSection;
