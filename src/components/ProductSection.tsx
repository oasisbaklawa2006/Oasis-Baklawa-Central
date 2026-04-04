import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { Loader2, Package, Plus, Minus } from "lucide-react";
import { getDisplayPrice, getMinOrderQty, getQtyIncrement } from "@/utils/pricing";

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
  const { addToCart, updateQuantity, items: cartItems } = useCart();

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
          <CompactCard key={item.id} item={item} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} updateQuantity={updateQuantity} cartItems={cartItems} priceTier={priceTier} />
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
        {products.map((item) => {
          const displayInfo = getDisplayPrice(item, priceTier);
          const mrp = Number(item?.mrp) || Number(item?.mrp_per_pc) || 0;
          const showMrpStrike = mrp > 0 && displayInfo.price > 0 && Math.abs(mrp - displayInfo.price) > 0.5;
          const cartItem = cartItems.find((ci) => ci.product_id === item.id);
          const currentQty = cartItem?.quantity ?? 0;
          const moq = getMinOrderQty(item);
          const increment = getQtyIncrement(item);

          return (
            <DefaultScrollCard
              key={item.id}
              item={item}
              displayInfo={displayInfo}
              mrp={mrp}
              showMrpStrike={showMrpStrike}
              currentQty={currentQty}
              moq={moq}
              increment={increment}
              cartItem={cartItem}
              navigate={navigate}
              formatPrice={formatPrice}
              addToCart={addToCart}
              updateQuantity={updateQuantity}
              priceTier={priceTier}
            />
          );
        })}
      </div>
    </section>
  );
};

/* ── Default horizontal scroll card with qty selector ── */
const DefaultScrollCard = ({ item, displayInfo, mrp, showMrpStrike, currentQty, moq, increment, cartItem, navigate, formatPrice, addToCart, updateQuantity }: any) => {
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  const handleInc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    await updateQuantity(cartItem.id, currentQty + increment);
  };

  const handleDec = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    const newQty = currentQty <= moq ? 0 : currentQty - increment;
    await updateQuantity(cartItem.id, Math.max(0, newQty));
  };

  return (
    <div
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
      <div className="flex items-baseline gap-1">
        <p className="font-number text-[11px] text-foreground font-semibold">
          {formatPrice(displayInfo.price)}{displayInfo.unit}
        </p>
        {showMrpStrike && (
          <span className="font-number text-[9px] text-muted-foreground line-through">
            {formatPrice(mrp)}
          </span>
        )}
      </div>
      {/* Qty selector */}
      {currentQty > 0 ? (
        <div className="flex items-center gap-1 mt-1">
          <button onClick={handleDec} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
            <Minus size={10} className="text-foreground" />
          </button>
          <span className="font-number text-xs font-semibold text-foreground min-w-[1.5rem] text-center">{currentQty}</span>
          <button onClick={handleInc} className="w-6 h-6 rounded-full bg-foreground text-primary-foreground flex items-center justify-center">
            <Plus size={10} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-1 w-full bg-foreground text-primary-foreground font-body text-[10px] font-medium py-1.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          Add
        </button>
      )}
    </div>
  );
};

const CompactCard = ({ item, navigate, formatPrice, addToCart, updateQuantity, cartItems, priceTier }: any) => {
  const [adding, setAdding] = useState(false);
  const displayInfo = getDisplayPrice(item, priceTier);
  const moq = getMinOrderQty(item);
  const increment = getQtyIncrement(item);
  const cartItem = cartItems.find((ci: any) => ci.product_id === item.id);
  const currentQty = cartItem?.quantity ?? 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(item.id, moq, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  const handleInc = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    await updateQuantity(cartItem.id, currentQty + increment);
  };

  const handleDec = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cartItem) return;
    const newQty = currentQty <= moq ? 0 : currentQty - increment;
    await updateQuantity(cartItem.id, Math.max(0, newQty));
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
      </div>
      <p className="font-body text-[11px] text-foreground line-clamp-1">{item.name}</p>
      <p className="font-number text-[10px] text-muted-foreground">
        {formatPrice(displayInfo.price)}{displayInfo.unit}
      </p>
      {/* Qty selector */}
      {currentQty > 0 ? (
        <div className="flex items-center gap-1 mt-1">
          <button onClick={handleDec} className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <Minus size={8} className="text-foreground" />
          </button>
          <span className="font-number text-[10px] font-semibold text-foreground min-w-[1.2rem] text-center">{currentQty}</span>
          <button onClick={handleInc} className="w-5 h-5 rounded-full bg-foreground text-primary-foreground flex items-center justify-center">
            <Plus size={8} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-1 w-full bg-foreground text-primary-foreground font-body text-[9px] font-medium py-1 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-0.5"
        >
          {adding ? <Loader2 size={8} className="animate-spin" /> : <Plus size={8} />}
          Add
        </button>
      )}
    </div>
  );
};

export default ProductSection;
