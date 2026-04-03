import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Plus } from "lucide-react";
import { motion } from "framer-motion";

interface ReorderProduct {
  id: string;
  name: string;
  image_url: string | null;
  price_per_kg: number;
  pack_size: string | null;
  carton_type: string | null;
  quantity: number;
}

const SmartReorderSection = () => {
  const [items, setItems] = useState<ReorderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { addToCart } = useCart();
  const { user, profileReady } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setItems([]);
      return;
    }
    const fetchReorders = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase
          .from("users").select("company_id").eq("id", user.id).maybeSingle();
        if (!userData?.company_id) { setLoading(false); return; }
        const { data: orders } = await supabase
          .from("orders").select("id").eq("company_id", userData.company_id)
          .order("created_at", { ascending: false }).limit(10);
        if (!orders || orders.length === 0) { setLoading(false); return; }
        const orderIds = orders.map(o => o.id);
        const { data: orderItems } = await supabase
          .from("order_items").select("product_id, quantity").in("order_id", orderIds);
        if (!orderItems || orderItems.length === 0) { setLoading(false); return; }
        const qtyMap: Record<string, number> = {};
        orderItems.forEach(oi => {
          if (oi.product_id) qtyMap[oi.product_id] = (qtyMap[oi.product_id] || 0) + Number(oi.quantity);
        });
        const sortedIds = Object.entries(qtyMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([id]) => id);
        if (sortedIds.length === 0) { setLoading(false); return; }
        const { data: products } = await supabase
          .from("products").select("id, name, image_url, price_per_kg, pack_size, carton_type")
          .in("id", sortedIds).eq("is_active", true);
        if (products) {
          setItems(sortedIds.map(id => {
            const p = products.find(pr => pr.id === id);
            if (!p) return null;
            return { ...p, quantity: qtyMap[id] };
          }).filter(Boolean) as ReorderProduct[]);
        }
      } catch (err) {
        console.warn("SmartReorder fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReorders();
  }, [user?.id]);

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 size={14} className="animate-spin text-primary" />
    </div>
  );

  if (items.length === 0) return null;

  return (
    <section className="px-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">Order Again</h2>
        <span className="font-body text-[8px] text-muted-foreground tracking-[0.15em] uppercase">Reorder in 1 tap</span>
      </div>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-1 snap-x">
        {items.map((item, i) => (
          <ReorderCard key={item.id} item={item} index={i} navigate={navigate} formatPrice={formatPrice} addToCart={addToCart} />
        ))}
      </div>
    </section>
  );
};

const ReorderCard = ({ item, index, navigate, formatPrice, addToCart }: any) => {
  const [adding, setAdding] = useState(false);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    await addToCart(item.id, 1, item.pack_size ?? null, item.carton_type ?? null);
    setAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/product/${item.id}`)}
      className="min-w-[120px] max-w-[120px] snap-start cursor-pointer flex-shrink-0 group"
    >
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-card border border-primary/6 flex items-center justify-center mb-2"
        style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        ) : (
          <Package size={16} className="text-muted-foreground" strokeWidth={1.3} />
        )}
        {/* Quick-add overlay button */}
        <button
          onClick={handleQuickAdd}
          disabled={adding}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={12} />}
        </button>
      </div>
      <p className="font-serif text-[10px] text-foreground line-clamp-1 mb-0.5">{item.name}</p>
      <p className="font-body text-[9px] text-foreground font-medium">
        {formatPrice(item.price_per_kg || item.price_b2b || item.wholesale_price || item.base_price || item.mrp || 0)}<span className="font-normal text-muted-foreground">/kg</span>
      </p>
    </motion.div>
  );
};

export default SmartReorderSection;
